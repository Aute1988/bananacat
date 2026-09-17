// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Migrator} from "./Migrator.sol";

/// @title MigratorRobinhood - Robinhood Chain 迁移器
/// @notice Robinhood Chain 是 Arbitrum Orbit L2,gas 用 ETH
/// @dev 初期没有成熟 AMM,所以 LP 通过 ETH 单边流动性记账(无 DEX 集成),
///      LP token 由 Migrator 自身映射,等 Robinhood 上线 DEX 后再实现真 AMM
contract MigratorRobinhood is Migrator {
    error RobinhoodAMMNotReady();

    constructor(
        address _lPLocker,
        address _feeRecipient
    ) Migrator(_lPLocker, address(0), address(0), _feeRecipient) {}

    /// @dev Robinhood Chain 暂无 AMM:明确 revert 让整个 migrate 事务回滚
    ///      graduatedTokens[token] = true 是 graduate 第一行设置,
    ///      所以 revert 会清空,不留下脏状态
    function _addLiquidityToDEX(
        address token,
        uint256 nativeAmount
    ) internal pure override returns (address, uint256) {
        revert RobinhoodAMMNotReady();
    }
}
