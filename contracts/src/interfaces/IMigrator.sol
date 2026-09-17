// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {LockPeriod} from "./IBananaCatToken.sol";

/// @title IMigrator - Migrator 合约接口
interface IMigrator {
    function graduate(
        address token,
        address bondingCurve,
        address creator,
        LockPeriod lockPeriod,
        uint256 nativeAmount
    ) external returns (bytes32 lockId);
}
