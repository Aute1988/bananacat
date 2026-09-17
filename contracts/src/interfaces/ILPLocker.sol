// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TokenLabel, TokenMode, TaxConfig, TokenConfig, LockPeriod} from "./IBananaCatToken.sol";

/// @title ILPLocker - LP 锁仓合约接口(扩展版)
/// @notice 香蕉猫平台的差异化功能:发币者自选锁仓期限
/// @dev 扩展功能(对比 v1):
///   - **续锁**: 到期后可以重新选一个期限,重新锁定
///   - **主动销毁**: 任何时候(不限于发币时)都可以把 LP 销毁
///   - **被动到期提取**: 原 v1 行为保留
interface ILPLocker {
    // ============================================================
    // 事件
    // ============================================================

    event LPLocked(
        bytes32 indexed lockId,
        address indexed token,
        address indexed creator,
        uint256 lpAmount,
        LockPeriod period,
        uint64 unlockTimestamp,
        address tokenOriginal
    );

    event LPClaimed(
        bytes32 indexed lockId,
        address indexed creator,
        uint256 lpAmount
    );

    event LPBurned(
        bytes32 indexed lockId,
        address indexed burner,
        uint256 lpAmount
    );

    /// @notice 续锁事件(原来 v1 没有)
    event LPExtended(
        bytes32 indexed oldLockId,
        bytes32 indexed newLockId,
        address indexed creator,
        LockPeriod newPeriod,
        uint64 newUnlockTimestamp
    );

    // ============================================================
    // 锁仓记录
    // ============================================================

    struct LockInfo {
        address token;           // 🆕 v4: LP token 地址(PancakeSwap pair),用于 claim/burn/extend
        address tokenOriginal;   // 🆕 v4: 原代币地址(只用于展示/关联)
        address creator;
        uint256 lpAmount;
        LockPeriod period;
        uint64 unlockTimestamp;
        bool claimed;
    }

    function locks(bytes32 lockId) external view returns (
        address token,
        address tokenOriginal,
        address creator,
        uint256 lpAmount,
        LockPeriod period,
        uint64 unlockTimestamp,
        bool claimed
    );

    /// @notice 锁仓是否已到期
    function isUnlocked(bytes32 lockId) external view returns (bool);

    /// @notice 锁仓是否已被销毁
    function isBurned(bytes32 lockId) external view returns (bool);

    // ============================================================
    // 操作(按权限分类)
    // ============================================================

    /// @notice 创建锁仓(只有工厂/Migrator 能调用)
    /// @dev 🆕 v2-fix: 第 1 个参数是 lpToken(PancakeSwap LP token 地址)
    ///                   后 4 个跟原版相同(token/creator/lpAmount/period)
    function lockLP(
        address lpToken,
        address token,
        address creator,
        uint256 lpAmount,
        LockPeriod period
    ) external returns (bytes32 lockId);

    /// @notice 提取 LP(创建者本人,锁仓到期后)
    function claimLP(bytes32 lockId) external;

    /// @notice 续锁(创建者,锁仓到期后调用)
    /// @param oldLockId 原锁仓 ID(必须已到期)
    /// @param newPeriod 新期限(可选:1天/7天/30天/365天/永久销毁)
    /// @return newLockId 新锁仓 ID
    function extendLock(bytes32 oldLockId, LockPeriod newPeriod) external returns (bytes32 newLockId);

    /// @notice 销毁 LP(创建者本人,任何时候)
    /// @dev 升级点:不限于发币时选永久销毁,到期后也能主动销毁
    function burnLPByCreator(bytes32 lockId) external;
}
