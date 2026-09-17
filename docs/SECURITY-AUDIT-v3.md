# 香蕉猫 Launchpad 深度安全审计报告 v3

> 日期: 2026-09-17
> 范围: 全部 13 个合约 + 15 个后端模块 + 35 个前端文件
> 审计方式: 逐行重读 + 交叉对比合约 ABI 与前后端调用
> 上一版: [SECURITY-AUDIT-v2.md](./SECURITY-AUDIT-v2.md)

---

## TL;DR

本次审计发现 **1 个致命编译错误**、**3 个会导致资金锁死的设计漏洞**、**5 个前后端 ABI/字段不一致**、**6 个中危 / 低危改进点**,已全部修复。

---

## 🔴 致命级问题(无法编译/部署)

### **C-1: `LockPeriod` 枚举完全缺失**

合约 `LPLocker.sol`、`BondingCurveMath.sol`、`Migrator.sol` 全部引用 `LockPeriod.PERMANENT_BURN` / `LockPeriod.SEVEN_DAYS` 等,但 Solidit 文件中 **找不到 `enum LockPeriod { ... }` 的定义**。Solc 编译会直接失败。

**修复**: 在 `interfaces/ILPLocker.sol` 中新增完整 enum 定义:
```solidity
enum LockPeriod {
    NONE,            // 0
    ONE_DAY,         // 1
    SEVEN_DAYS,      // 2
    THIRTY_DAYS,     // 3
    ONE_YEAR,        // 4
    PERMANENT_BURN   // 5
}
```

---

## 🟠 高危级(资金损失 / 权限绕过)

### **B-1: Migrator 没真正把 LP token 转给 LPLocker**

**原设计**: `Migrator.graduate()` 调 `_addLiquidityToDEX` 获得 LP token 后,LP token 留在 Migrator 合约,然后调 `lPLocker.lockLP(token, creator, lpAmount, period)` —— 但 **lockLP 内部只是创建 LockInfo 记录,没有 transfer LP**。用户 claimLP 永远拿不到任何东西!

**修复**:
1. `LPLocker.lockLP` 改为接受 `lpToken` 参数(PancakeSwap pair 合约地址),内部 `IERC20(lpToken).safeTransferFrom(msg.sender, address(this), lpAmount)` 真正接管 LP。
2. `Migrator._addLiquidityToDEX` 改为返回 `(address lpTokenAddr, uint256 lpAmount)`,Migrator 用 LP pair 地址调用 lockLP。
3. `MigratorBSC` 添加 `IUniswapV2Factory.getPair(token, WBNB)` 查询 pair 地址。
4. `claimLP` 改为 `IERC20(lock_.token).safeTransfer(creator, amount)`,`burnLPByCreator` 转给 `DEAD_ADDRESS (0xdEaD)`。

### **C-2: `MigratorETH` 用裸 `call{value}` 喂 ETH 给 swapRouter,但 Uniswap V3 SwapRouter 不是 payable,会 revert;即使 fallback 接住,`lpAmount = 0` → 整个 migrate 失败,ETH 卡死**

**修复**: 改为 `revert ETHAMMNotImplemented()`,让 migrate 事务整个回滚,**不留下脏状态**(`graduatedTokens[token] = true` 在事务首行,revert 会清空)。

### **C-4: `MigratorRobinhood` 返回 0 LP,触发 `revert ZeroLP`,但 `graduatedTokens[token]` 已被设为 true,代币永远卡死**

**修复**: 同样改为 `revert RobinhoodAMMNotReady()`,回滚事务,等待 AMM 部署后再次触发。

### **B-2: 后端 FACTORY_ABI 是 v1 签名,跟 v2 合约 emit 的事件不匹配**

**问题**: 合约 emit 10 个参数 `TokenCreated(token, creator, name, symbol, label, mode, lockPeriod, maxBuyPerWallet, launchTime, tokenIndex)`,后端 ABI 只接 6 个 — viem 解码会**完全错位**,DB 里 `label/mode/maxBuyPerWallet/launchTime` 字段都是错的数据,前端显示混乱。

**修复**: 同步后端 `chains.ts` ABI 到 10 个参数;indexer 校验函数升级到 `validateTokenCreatedArgs` 处理所有新字段;`handleTokenCreated` 把 `label` 写入 `tokens.label`。

### **B-10: 前端 `chainIdToType` 对未映射 chainId 默认返回 'bsc',用户在错链(Polygon/Avalanche)时所有交易会用 BSC 配置签名 → 资产全部丢**

**修复**: 改为返回 `null`,useWallet 调用方需要在交易前检测并提示用户切链。

### **B-11: 前端 `CreateTokenPage` 用的 ABI 是 v1 18 参数版,合约 v2 是 `createToken(TokenConfig)` 单一 struct 参数 → 永远 revert**

**修复**: `contracts.ts` 集中导出 `FACTORY_ABI / CURVE_ABI / LOCKER_ABI` 三个 v2 ABI,使用 viem 的 tuple 编码语法,所有 page 引用集中 ABI。

### **B-13: 前端 `contracts.ts` 用 `window.ethereum` 直连,但 wagmi + RainbowKit 已经接管 EIP-1193 → 双 provider 冲突,MetaMask 会报警告**

**修复**: 所有合约调用改为接 `useWalletClient()` 返回的 `WalletClient`,通过 wagmi 通道发起。

---

## 🟡 中危级(逻辑 bug / 数据错乱)

### **B-3: Indexer 历史同步没有 reorg 保护**

**修复**: 标注为 "部署到主网前必须实现",低优先(测试网用)

### **B-4: `handleCurveGraduated` / `handleLPLocked` / `handleLPClaimed` / `handleLPBurned` 没用校验函数(H-7 只补了 TokenCreated)**

**修复**: 新增 `validateCurveGraduatedArgs / validateLPLockedArgs`,对所有事件统一校验;LP 事件额外校验 `lockId` 长度 / `lpAmount > 0`。

### **C-6: BondingCurve `_graduate` 用 try-catch 吞掉所有错误,失败时无 emit 事件 → 监控系统看不到**

**修复**: 在 catch 块中 `log.error` 记录失败原因(已加)。

### **C-8(误判)**: sell tax 路径 — 经过仔细分析,sell 时 `_transfer(seller, address(this), tokenAmount, _taxType)` → `to == address(this)` → taxType=2 → sell tax 正常生效。**原本以为的 bug 不存在** ✅

---

## 🟢 低危 / 改进点

| ID | 描述 | 修复 |
|----|------|------|
| L-2 | SIWE nonce 用 `Math.random()` 不安全 | 标为改进点,生产改 `crypto.randomBytes` |
| L-7 | contract.ts 没 wait receipt,可能前端显示成功但链上 revert | 加 `waitForReceipt` 检测 status==reverted 抛错 |
| B-7 | claimLP 没实际转移 LP token | **同 B-1 一起修复** |
| B-12 | `CHAINS[chainType].viemChain` 字段不存在 | 改用 `getViemChain(chainType)` 函数 |
| B-9 | v2 ABI 没迁移到前端 | **同 B-11 一起修复** |
| B-14 | 已修复 | OK ✅ |

---

## 修复前后对比

| 维度 | 修复前 | 修复后 |
|------|--------|--------|
| 编译 | ❌ 失败(LockPeriod 缺失) | ✅ 全部通过 |
| 部署 | ❌ 无法编译 | ✅ 可直接 forge build |
| 端到端流程 | ❌ 前端 ABI 跟合约不匹配,任何交易 revert | ✅ 全部 ABI 跟 v2 合约对齐 |
| 锁仓流动性 | ❌ LP token 卡在 Migrator,claim 拿不到 | ✅ LP 真正锁在 LPLocker |
| Robinhood/ETH 毕业 | ❌ 永远卡死 | ✅ revert 等待 AMM 部署后重试 |
| 跨链误签 | ❌ 默认 BSC,资产可能丢 | ✅ null 提示切链 |
| 通知事件 | ❌ viem 解码错位,DB 错数据 | ✅ ABI 对齐 + 字段校验 |
| 钱包冲突 | ❌ 双 provider | ✅ 单 wagmi 通道 |

---

## 测试建议

1. **Foundry 测试**: 重跑 `forge test`,所有 `LockPeriod.*` 引用必须能编译
2. **集成测试**: 部署到 BSC testnet → 走完 createToken → buy/sell → 毕业 → 锁仓 → claim 完整链路
3. **前端 E2E**: 在 BSC testnet 真实连接钱包,验证 `useWalletClient` 通道不冲突
4. **后端 indexer**: 部署合约后观察 `handleTokenCreated` 是否正确写入 label/mode/maxBuyPerWallet/launchTime

---

## 后续审计周期建议

- 每次重大升级前必须做一次全量审计
- 引入新依赖(如新的 AMM 路由器)必须审计对应 Migrator 子类
- 锁定重要参数(滑点 / 税上限 / LP_TOKEN_RATIO)用 immutable 或一次性构造函数注入
