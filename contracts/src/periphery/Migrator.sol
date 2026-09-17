// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IBondingCurve} from "../interfaces/IBondingCurve.sol";
import {ILPLocker, LockPeriod} from "../interfaces/ILPLocker.sol";
import {BondingCurveMath} from "../libraries/BondingCurveMath.sol";

/// @title Migrator - 香蕉猫平台流动性迁移器(基类)
/// @notice 当联合曲线达到 100% 时,自动把:
///   1. 剩余代币 + 曲线积累的平台币 → 添加到 DEX LP
///   2. LP 按发币者选的锁仓期限 → 锁入 LPLocker
/// @dev 关键流程:
///   - 触发时机:曲线累计 >= graduationTarget
///   - 添加流动性到 DEX(各链 PancakeSwap / Uniswap / 自建池)
///   - 80% 代币已在市场流通,20% 进入 LP
///   - LP 按发币者选择的期限锁仓
///   - PERMANENT_BURN → LP 直接销毁(LPLocker.lockLP 内部已触发销毁)
abstract contract Migrator {
    /// @notice 平台收取的毕业费用(0.5 BNB,防止dust攻击)
    uint256 public constant GRADUATION_FEE = 0.5 ether;

    ILPLocker public immutable lPLocker;
    address public immutable dexRouter;
    address public immutable wNative;
    address public immutable feeRecipient;

    mapping(address => bool) public graduatedTokens;

    event TokenGraduated(
        address indexed token,
        uint256 nativeAmount,
        uint256 lpAmount,
        LockPeriod lockPeriod,
        bytes32 lockId
    );

    error AlreadyGraduated();
    error InsufficientReserve();
    error TransferFailed();
    error ZeroAddress();
    error ZeroLP();

    constructor(
        address _lPLocker,
        address _dexRouter,
        address _wNative,
        address _feeRecipient
    ) {
        if (_lPLocker == address(0) || _feeRecipient == address(0)) revert ZeroAddress();
        lPLocker = ILPLocker(_lPLocker);
        dexRouter = _dexRouter;
        wNative = _wNative;
        feeRecipient = _feeRecipient;
    }

    function graduate(
        address token,
        address bondingCurve,
        address creator,
        LockPeriod lockPeriod,
        uint256 nativeAmount
    ) external returns (bytes32 lockId) {
        if (graduatedTokens[token]) revert AlreadyGraduated();
        graduatedTokens[token] = true;

        if (nativeAmount <= GRADUATION_FEE) revert InsufficientReserve();
        uint256 lpNative = nativeAmount - GRADUATION_FEE;

        // 转平台币手续费给平台
        (bool ok,) = feeRecipient.call{value: GRADUATION_FEE}("");
        if (!ok) revert TransferFailed();

        // 把剩余 BNB 转到 Migrator 用于添加流动性
        (bool ok2,) = payable(this).call{value: lpNative}("");
        if (!ok2) revert TransferFailed();

        // 🆕 修复 B-1: 子类返回 (LP token 地址, LP 数量)
        (address lpTokenAddr, uint256 lpAmount) = _addLiquidityToDEX(token, lpNative);
        if (lpAmount == 0 || lpTokenAddr == address(0)) revert ZeroLP();

        // 把 LP token 转移给 LPLocker(它会 safeTransferFrom 从我们这里拿)
        lockId = lPLocker.lockLP(
            lpTokenAddr,
            token,
            creator,
            lpAmount,
            lockPeriod
        );

        emit TokenGraduated(token, lpNative, lpAmount, lockPeriod, lockId);
    }

    // ============================================================
    // 子类实现:在不同链的 DEX 上添加流动性
    // 返回 (LP token 地址, LP amount)。
    // LP amount = 0 → 整个事务回滚(防止卡死)
    // ============================================================

    function _addLiquidityToDEX(
        address token,
        uint256 nativeAmount
    ) internal virtual returns (address lpTokenAddr, uint256 lpAmount);

    receive() external payable {}
}
