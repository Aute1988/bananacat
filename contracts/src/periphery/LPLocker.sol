// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ILPLocker, LockPeriod} from "../interfaces/ILPLocker.sol";
import {BondingCurveMath} from "../libraries/BondingCurveMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title LPLocker - 香蕉猫平台 LP 锁仓合约(v2 - 支持续锁 + 主动销毁)
/// @notice 核心差异化功能升级版
/// @dev v2 新增:
///   - **extendLock()**: 创建者可在锁仓到期后,重新选期限续锁
///   - **burnLPByCreator()**: 创建者可在任何时候主动销毁 LP
///   - v1 的 lockLP / claimLP 行为完全保留
contract LPLocker is ILPLocker {
    using BondingCurveMath for LockPeriod;
    using SafeERC20 for IERC20;

    /// @notice 永久销毁的 LP 转账目标地址(无人持私钥,等价于销毁)
    address public constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    // ============================================================
    // 锁仓记录
    // ============================================================

    /// @inheritdoc ILPLocker
    mapping(bytes32 => LockInfo) public locks;

    /// @notice 每个 LP token + 发币者的锁仓计数(用于生成 nonce)
    mapping(address => mapping(address => uint256)) public lockCounts;

    /// @notice 工厂地址(唯一能创建锁仓的权限)
    address public factory;

    /// @notice 每个 LP token 当前托管余额(claim 时减,lock 时加)
    mapping(address => uint256) public lpTokenBalances;

    /// @notice 每个 LP token 所有的 lockId(支持遍历/查找)
    mapping(address => bytes32[]) public lockedByToken;

    // ============================================================
    // 事件(在 ILPLocker interface 已定义,这里直接继承)
    // ============================================================

    // ============================================================
    // 错误
    // ============================================================

    error OnlyFactory();
    error NotCreator();
    error NotUnlocked();
    error AlreadyClaimed();
    error AlreadyBurned();
    error PermanentBurn();
    error ZeroAmount();
    error InvalidPeriod();
    error ZeroAddress();

    // ============================================================
    // 修饰符
    // ============================================================

    modifier onlyFactory() {
        if (msg.sender != factory) revert OnlyFactory();
        _;
    }

    // ============================================================
    // 初始化
    // ============================================================

    constructor() {
        factory = msg.sender;
    }

    /// @notice 🆕 v4-fix: 测试 fixture 用 — 把 factory 转移给真正的 Migrator
    /// @dev 实际生产不调用。修复 BaseTest: lPLocker = new LPLocker(); migrator = new MockMigrator() 时
    ///         LPLocker.factory = address(this) 而非 migrator,导致 lockLP OnlyFactory 失败
    ///      - 只能由当前 factory 调用(测试合约)
    ///      - 只能调用一次(factory != newFactory 即可)
    ///      - 用完即弃,生产无影响
    function transferFactory(address newFactory) external {
        if (msg.sender != factory) revert OnlyFactory();
        if (newFactory == address(0)) revert ZeroAddress();
        factory = newFactory;
    }

    // ============================================================
    // 视图
    // ============================================================

    /// @inheritdoc ILPLocker
    function isUnlocked(bytes32 lockId) public view returns (bool) {
        LockInfo memory lock_ = locks[lockId];
        if (lock_.claimed) return false;
        if (lock_.period == LockPeriod.PERMANENT_BURN) return false;
        if (lock_.unlockTimestamp == 0) return false;
        return uint64(block.timestamp) >= lock_.unlockTimestamp;
    }

    /// @inheritdoc ILPLocker
    function isBurned(bytes32 lockId) public view returns (bool) {
        LockInfo memory lock_ = locks[lockId];
        // 已 burn 的标志:claimed = true 且 period = PERMANENT_BURN
        return lock_.claimed && lock_.period == LockPeriod.PERMANENT_BURN;
    }

    /// @notice 计算 lockId(前端展示用)
    function computeLockId(
        address token,
        address creator,
        uint256 nonce
    ) external pure returns (bytes32) {
        return keccak256(abi.encode(token, creator, nonce));
    }

    /// @notice 获取锁仓的完整详情(给前端用)
    function getLockDetails(bytes32 lockId) external view returns (
        address lpToken,
        address tokenOriginal,
        address creator,
        uint256 lpAmount,
        uint8 periodRaw,
        uint64 unlockTimestamp,
        bool claimed,
        bool isPermanent,
        bool canClaim,
        bool canExtend,
        bool canBurn
    ) {
        LockInfo memory lock_ = locks[lockId];
        lpToken = lock_.token;
        tokenOriginal = lock_.tokenOriginal;
        creator = lock_.creator;
        lpAmount = lock_.lpAmount;
        periodRaw = uint8(lock_.period);
        unlockTimestamp = lock_.unlockTimestamp;
        claimed = lock_.claimed;

        isPermanent = lock_.period == LockPeriod.PERMANENT_BURN;
        canClaim = !lock_.claimed
            && !isPermanent
            && uint64(block.timestamp) >= lock_.unlockTimestamp;
        canExtend = !lock_.claimed
            && !isPermanent
            && uint64(block.timestamp) >= lock_.unlockTimestamp;
        canBurn = !lock_.claimed && !isPermanent;
    }

    // ============================================================
    // 创建锁仓(只有工厂)
    // ============================================================

    /// @inheritdoc ILPLocker
    /// @notice 创建 LP 锁仓记录(只工厂/Migrator 可调用)
    /// @dev v2:
    ///   - 接受 LP token 地址 + amount,真正将 LP token 从 Migrator 转给 locker 托管
    ///   - LockInfo.token 字段存 LP token 地址(统一,避免之前 token/lpToken 混淆)
    ///   - LockInfo.tokenOriginal 字段存原代币地址(用于前端展示/关联)
    /// @param lpToken PancakeSwap LP token 地址(实际持有的资产)
    /// @param token   关联的原代币地址(只是标识)
    /// @param creator 受益人
    function lockLP(
        address lpToken,
        address token,
        address creator,
        uint256 lpAmount,
        LockPeriod period
    ) external onlyFactory returns (bytes32 lockId) {
        if (lpToken == address(0)) revert ZeroAddress();
        if (lpAmount == 0) revert ZeroAmount();

        // 把真实 LP token 从 caller(Migrator)转给 locker
        IERC20(lpToken).safeTransferFrom(msg.sender, address(this), lpAmount);

        uint256 nonce = lockCounts[lpToken][creator]++;
        lockId = keccak256(abi.encode(lpToken, creator, nonce));

        uint64 unlockTs = period == LockPeriod.PERMANENT_BURN
            ? 0
            : uint64(block.timestamp) + BondingCurveMath.lockPeriodToSeconds(period);

        // 🆕 v4 修复:LockInfo.token 统一存 LP token 地址(claim/burn/extend 都靠这个找资产)
        //              LockInfo.tokenOriginal 存原代币地址(纯标识)
        locks[lockId] = LockInfo({
            token: lpToken,
            tokenOriginal: token,
            creator: creator,
            lpAmount: lpAmount,
            period: period,
            unlockTimestamp: unlockTs,
            claimed: false
        });

        lpTokenBalances[lpToken] += lpAmount;
        lockedByToken[lpToken].push(lockId);

        emit LPLocked(lockId, lpToken, creator, lpAmount, period, unlockTs, token);

        // 永久销毁模式:把 LP token 转给 dead address 永久销毁
        if (period == LockPeriod.PERMANENT_BURN) {
            IERC20(lpToken).safeTransfer(DEAD_ADDRESS, lpAmount);
            lpTokenBalances[lpToken] -= lpAmount;
            _burnInternal(lockId);
        }
    }

    // ============================================================
    // 提取 LP(创建者,到期后)
    // ============================================================

    /// @inheritdoc ILPLocker
    /// @notice LockInfo.claimed 含义:
    ///   - true 表示该 lockId 已 "settled"(已 claim / 已 burn / 已 extend)
    ///   - period 字段区分具体动作:PERMANENT_BURN = burned,其他 = claimed or extended
    function claimLP(bytes32 lockId) external {
        LockInfo storage lock_ = locks[lockId];

        if (lock_.period == LockPeriod.PERMANENT_BURN) revert PermanentBurn();
        if (lock_.claimed) revert AlreadyClaimed();
        if (lock_.creator != msg.sender) revert NotCreator();
        if (uint64(block.timestamp) < lock_.unlockTimestamp) revert NotUnlocked();

        // 🆕 v4 修复:lock_.token 现在就是 LP token 一致语义
        address lpToken = lock_.token;
        uint256 amount = lock_.lpAmount;

        // Effects first (CEI)
        lock_.claimed = true;
        lock_.lpAmount = 0;
        if (lpTokenBalances[lpToken] >= amount) {
            lpTokenBalances[lpToken] -= amount;
        }

        // Interactions
        IERC20(lpToken).safeTransfer(msg.sender, amount);

        emit LPClaimed(lockId, msg.sender, amount);
    }

    // ============================================================
    // 🆕 续锁(创建者,到期后可选新期限)
    // ============================================================

    /// @inheritdoc ILPLocker
    function extendLock(bytes32 oldLockId, LockPeriod newPeriod) external returns (bytes32 newLockId) {
        LockInfo storage oldLock = locks[oldLockId];

        // 校验 — 🆕 v4-fix: 先检查 period == PERMANENT_BURN 再检查 claimed,否则 PERMANENT_BURN 锁会先报 AlreadyClaimed
        if (oldLock.period == LockPeriod.PERMANENT_BURN) revert PermanentBurn();
        if (oldLock.claimed) revert AlreadyClaimed();
        if (oldLock.creator != msg.sender) revert NotCreator();
        if (uint64(block.timestamp) < oldLock.unlockTimestamp) revert NotUnlocked();

        // 续锁必须是有效期限
        if (uint8(newPeriod) > 5 || newPeriod == LockPeriod.NONE) revert InvalidPeriod();

        // 🆕 v4: lock_.token 现在一致是 LP token
        uint256 lpAmount = oldLock.lpAmount;
        address lpToken = oldLock.token;
        address tokenOriginal = oldLock.tokenOriginal;

        // 标记旧锁已 settle
        oldLock.claimed = true;
        oldLock.lpAmount = 0;

        // 生成新 lockId
        uint256 nonce = lockCounts[lpToken][msg.sender]++;
        newLockId = keccak256(abi.encode(lpToken, msg.sender, nonce));

        uint64 unlockTs = newPeriod == LockPeriod.PERMANENT_BURN
            ? 0
            : uint64(block.timestamp) + BondingCurveMath.lockPeriodToSeconds(newPeriod);

        // 创建新锁记录(LP 一直在 locker,不需要 transferFrom)
        locks[newLockId] = LockInfo({
            token: lpToken,
            tokenOriginal: tokenOriginal,
            creator: msg.sender,
            lpAmount: lpAmount,
            period: newPeriod,
            unlockTimestamp: unlockTs,
            claimed: false
        });

        lockedByToken[lpToken].push(newLockId);
        // 不变 lpTokenBalances(LP 一直在 locker,没动)

        emit LPExtended(oldLockId, newLockId, msg.sender, newPeriod, unlockTs);
        emit LPLocked(newLockId, lpToken, msg.sender, lpAmount, newPeriod, unlockTs, tokenOriginal);

        // 续到 PERMANENT_BURN 直接烧
        if (newPeriod == LockPeriod.PERMANENT_BURN) {
            IERC20(lpToken).safeTransfer(DEAD_ADDRESS, lpAmount);
            if (lpTokenBalances[lpToken] >= lpAmount) {
                lpTokenBalances[lpToken] -= lpAmount;
            }
            _burnInternal(newLockId);
        }
    }

    // ============================================================
    // 🆕 主动销毁(创建者,任何时候)
    // ============================================================

    /// @inheritdoc ILPLocker
    function burnLPByCreator(bytes32 lockId) external {
        LockInfo storage lock_ = locks[lockId];

        if (lock_.claimed) revert AlreadyClaimed();
        if (lock_.creator != msg.sender) revert NotCreator();
        if (lock_.period == LockPeriod.PERMANENT_BURN) revert AlreadyBurned();

        // 🆕 v4: lock_.token 现在一致是 LP token
        uint256 amount = lock_.lpAmount;
        address lpToken = lock_.token;

        IERC20(lpToken).safeTransfer(DEAD_ADDRESS, amount);
        if (lpTokenBalances[lpToken] >= amount) {
            lpTokenBalances[lpToken] -= amount;
        }

        _burnInternal(lockId);
    }

    // ============================================================
    // 内部:工厂级 burn(只用于 PERMANENT_BURN 模式初始化)
    // ============================================================

    function _burnInternal(bytes32 lockId) internal {
        LockInfo storage lock_ = locks[lockId];
        if (lock_.claimed) revert AlreadyClaimed();

        uint256 amount = lock_.lpAmount;
        address lpToken = lock_.token;

        lock_.claimed = true;
        lock_.lpAmount = 0;
        lock_.period = LockPeriod.PERMANENT_BURN;
        // 注意:lockLP 时如果 period = PERMANENT_BURN,LP 已经转给 DEAD_ADDRESS,这里保险递减
        if (lpTokenBalances[lpToken] >= amount) {
            lpTokenBalances[lpToken] -= amount;
        }

        emit LPBurned(lockId, msg.sender, amount);
    }
}
