// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Migrator} from "./Migrator.sol";

/// @title MigratorArc - Circle Arc 链迁移器
/// @notice Circle Arc 用 USDC 作为原生 gas 代币
/// @dev Arc 是 EVM 兼容链,理论上支持标准 Uniswap V2/V3
///      初期先用 USDC 替代 WETH 作为配对资产
contract MigratorArc is Migrator {
    // Arc 上 USDC 的 ERC-20 地址(6 decimals)
    address public constant USDC = 0x3600000000000000000000000000000000000000;

    // Arc 上的 AMM Router(待定)
    address public constant AMM_ROUTER = 0x0000000000000000000000000000000000000001;

    error ArcAMMNotAvailable();

    constructor(
        address _lPLocker,
        address _feeRecipient
    ) Migrator(_lPLocker, AMM_ROUTER, USDC, _feeRecipient) {}

    /// @dev 🆕 修复 L-4: 之前返回 0 LP,导致 lPLocker.lockLP(0) 调用 ZeroAmount revert,
    ///              但 graduatedTokens[token] 已被设为 true,曲线卡死。
    ///              现在明确 revert,让整个 graduate 事务回滚,曲线可以重试。
    function _addLiquidityToDEX(
        address token,
        uint256 nativeAmount
    ) internal pure override returns (address, uint256) {
        revert ArcAMMNotAvailable();
    }
}

