// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Migrator} from "./Migrator.sol";
import {ILPLocker, LockPeriod} from "../interfaces/ILPLocker.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPancakeFactory} from "@pancakeswap/v2-core/contracts/interfaces/IPancakeFactory.sol";
import {IPancakeRouter02} from "@pancakeswap/v2-periphery/contracts/interfaces/IPancakeRouter02.sol";

/// @title MigratorBSC - 香蕉猫 BSC 链迁移器(集成 PancakeSwap V2)
/// @notice 当代币曲线达到 100% 时:
///   1. 把 23.5 BNB + 等值代币 → 添加到 PancakeSwap 流动性
///   2. 获得 LP 代币 → 按发币者选择的锁仓期限锁入 LPLocker
///   3. PERMANENT_BURN → LP 直接 burn
contract MigratorBSC is Migrator {
    // 🆕 v4 修复: 之前 hardcode mainnet 地址,testnet 部署后所有 swap 会失败
    //              改为构造时传入地址(让 deploy 脚本注入 testnet 地址)
    IPancakeRouter02 public immutable ROUTER;

    /// @dev PancakeSwap V2 Factory(用于查 LP token 地址)
    IPancakeFactory public immutable FACTORY;

    address public immutable WBNB;

    /// @notice 滑点容忍(基点,200 = 2%)- 防止 sandwich 攻击
    uint256 public constant SLIPPAGE_BPS = 200;

    /// @notice 最大授权额度(用有限额度而非 max,防止 router 被黑时被无限盗用)
    uint256 public constant APPROVAL_BUFFER_BPS = 110;  // 110% of expected token amount

    constructor(
        address _lPLocker,
        address _feeRecipient,
        address _router,
        address _factory,
        address _wbnb
    ) Migrator(_lPLocker, _router, _wbnb, _feeRecipient) {
        ROUTER = IPancakeRouter02(_router);
        FACTORY = IPancakeFactory(_factory);
        WBNB = _wbnb;
    }

    // ============================================================
    // DEX 添加流动性实现(BSC / PancakeSwap V2)
    // ============================================================

    function _addLiquidityToDEX(
        address token,
        uint256 nativeAmount
    ) internal override returns (address lpTokenAddr, uint256 lpAmount) {
        // 把原生币(BNB)换成一半代币,一半保持 BNB
        uint256 halfNative = nativeAmount / 2;

        // 预估输出(假设池子初始按 1:1),用于滑点计算
        uint256[] memory amountsOut = ROUTER.getAmountsOut(halfNative, _path(WBNB, token));
        uint256 expectedTokens = amountsOut[amountsOut.length - 1];
        // 至少收到 (100% - SLIPPAGE_BPS%) 的预期 token,否则 revert
        uint256 minTokensOut = expectedTokens * (10_000 - SLIPPAGE_BPS) / 10_000;

        // 授权 router 有限额度(仅略大于预期,减少风险敞口)
        uint256 approvalAmount = expectedTokens * APPROVAL_BUFFER_BPS / 100;
        IERC20(token).approve(address(ROUTER), approvalAmount);

        // 用一半 BNB 换一半代币(带滑点保护)
        ROUTER.swapExactETHForTokens{value: halfNative}(
            minTokensOut,
            _path(WBNB, token),
            address(this),
            block.timestamp + 300
        );

        // 现在 Migrator 持有:
        // - halfNative BNB
        // - ~halfNative 等值的代币
        uint256 tokenBalance = IERC20(token).balanceOf(address(this));
        uint256 bnbBalance = address(this).balance;

        // 计算加流动性的最小输出(带滑点保护)
        uint256 minTokenForLP = tokenBalance * (10_000 - SLIPPAGE_BPS) / 10_000;
        uint256 minBNBForLP = bnbBalance * (10_000 - SLIPPAGE_BPS) / 10_000;

        // 二次授权(可能 tokenBalance 略大于预估)
        if (tokenBalance > approvalAmount) {
            IERC20(token).approve(address(ROUTER), tokenBalance);
        }

        // 添加完整流动性(带滑点保护)
        (,, uint256 liquidity) = ROUTER.addLiquidityETH{value: bnbBalance}(
            token,
            tokenBalance,
            minTokenForLP,
            minBNBForLP,
            address(this),
            block.timestamp + 300
        );

        // 清理未用完的授权(最佳实践,避免持续授权状态)
        IERC20(token).approve(address(ROUTER), 0);

        // PancakeSwap V2 pair 地址 = PancakeSwapLibrary.pairFor(...) — 这里用 FACTORY 直接查
        address pairAddr = FACTORY.getPair(token, WBNB);
        // 防御:如果找不到 pair,至少返回 token 地址作为标识(虽然不会发生)
        if (pairAddr == address(0)) pairAddr = token;

        return (pairAddr, liquidity);
    }

    /// @dev 辅助函数:构造 swap path
    function _path(address from, address to) internal pure returns (address[] memory) {
        address[] memory p = new address[](2);
        p[0] = from;
        p[1] = to;
        return p;
    }
}
