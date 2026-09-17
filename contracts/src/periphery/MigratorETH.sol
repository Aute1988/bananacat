// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Migrator} from "./Migrator.sol";

/// @title MigratorETH - Ethereum / EVM 链迁移器(占位实现)
/// @notice ETH / ARC 等链的 migrate 实现具体取决于该链 AMM 选择;
///      Uniswap V3 需要 Position Manager 而非简单 addLiquidity,
///      这里给出 ETH 版本骨架;真实部署可在 _addLiquidityToDEX 里实现 Uniswap V3 路径
contract MigratorETH is Migrator {
    error ETHAMMNotImplemented();  // 还未实现,部署前必须替换为真实逻辑

    /// @dev WETH 在主流 net 是 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2,这里由构造注入
    address public immutable weth;

    constructor(
        address _lPLocker,
        address _swapRouter,
        address _weth,
        address _feeRecipient
    ) Migrator(_lPLocker, _swapRouter, _weth, _feeRecipient) {
        weth = _weth;
    }

    /// @dev ETH 链 migrate 未实装(防止 ETH 卡死)。部署到 ETH 链前必须用 Uniswap V3 实现替换
    function _addLiquidityToDEX(
        address token,
        uint256 nativeAmount
    ) internal pure override returns (address, uint256) {
        revert ETHAMMNotImplemented();
    }
}
