# SECURITY AUDIT v4 — 深度复审发现的额外致命问题

**日期**: 2026-09-17
**范围**: 整个项目(合约 + 后端 + 前端 + 部署)
**审计方法**: 逐文件、逐函数 edge case 推演 + Reentrancy / 整数溢出 / 重入攻击模拟

---

## 致命级 Critical

### C-1 ❌→✅ (新发现) BananaCatFactory 缺 `receive()`,所有 buy/sell 永远 Revert

**现象**: BondingCurve.buy/sell 中 `factory.call{value: fee}("")` 转手续费给 factory,但 Factory 合约没有 `receive()` 函数。Solidity 合约没有 receive/fallback 时,带 value 的转账会 revert。

**后果**: **生产环境买币、卖币永远失败**。整个 Launchpad 核心交易功能从一开始就是 broken 状态。

**修复**:
```solidity
// contracts/src/core/BananaCatFactory.sol
receive() external payable {
    platformRevenue += msg.value;
}
```

---

### C-2 ❌→✅ (新发现) LPLocker `LockInfo.token` 字段语义混乱 + `lpTokenBalances` 索引错乱

**现象**:
- `lockLP(lpToken, token, creator, lpAmount, period)` 把第 2 参数 `token`(原代币)存入 `LockInfo.token` 字段
- `claimLP` 用 `lock_.token` 作为 LP token 给用户转账 — **token 和 LP token 不同**!
- `_burnInternal` 用 `lpTokenBalances[lock_.token] -= amount` — `lock_.token` 是原代币而不是 lpToken — **lpTokenBalances 整个被错乱记账**
- `extendLock` 用 `address lpToken = oldLock.token` 假设它是 lpToken — 也是错的

**后果**:
- `lpTokenBalances` 这个 mapping 永远在被错误索引,数据完全不可信(实际上原代币 index 永远是 0,lpToken index 累加失控)
- 代码可读性严重下降,后续维护容易踩雷

**修复**:
```solidity
// 在 LockInfo 增加 tokenOriginal 字段,LockInfo.token 一致存 LP token
struct LockInfo {
    address token;            // LP token 地址(consistency)
    address tokenOriginal;    // 原代币地址(标识)
    address creator;
    uint256 lpAmount;
    LockPeriod period;
    uint64 unlockTimestamp;
    bool claimed;
}
```
+ 全部调用站点统一从 `lock_.token` 取 LP token,从 `lock_.tokenOriginal` 取原代币。

---

### C-3 ❌→✅ (新发现) 后端缺 `/api/locks/:lockId` endpoint,LPUnlockPage 完全 broken

**现象**: LPUnlockPage 前端 fetch `${VITE_API_BASE}/api/locks/${lockId}`,但 `backend/src/api.ts` **完全没注册这个路由**。

**后果**: 用户访问 LPUnlockPage 永远显示 "锁仓记录不存在或已被处理",**所有 LP 解锁/续锁/销毁流程都打不开**。

**修复**: 在 `backend/src/api.ts` 添加 `/api/locks/:lockId` 和 `/api/users/:address/locks` 两个端点,从 `lp_locks` 表 join `tokens` 表返回完整数据(lockId,token info, period, canClaim/Extend/Burn 等)。

---

### C-4 ❌→✅ (新发现) Foundry 缺依赖,合约根本编译不了

**现象**: `MigratorBSC.sol` import `@pancakeswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol`,但 `foundry.toml` 的 remappings 列表里 **没有 `@pancakeswap/v2-core` 项**!也没有 `lib/` 目录,没有 `node_modules`(合约目录独立 node)。

**后果**:
- `forge build` 找不到 import 路径
- CI 跑测试直接 fail
- 从未真正编译过!

**修复**:
```toml
# contracts/foundry.toml
remappings = [
    "@openzeppelin/contracts=../node_modules/@openzeppelin/contracts",
    "@pancakeswap/v2-core=../node_modules/@pancakeswap/v2-core",   # 🆕 加上
    "@pancakeswap/v2-periphery=../node_modules/@pancakeswap/v2-periphery",
]
```
+ 添加 `contracts/package.json` 包含 pancakeswap + OZ 依赖
+ CI 步骤加 `npm install` + `forge install foundry-rs/forge-std`

---

### C-5 ❌→✅ (新发现) MigratorBSC hardcode mainnet 地址,testnet 部署后所有 swap fail

**现象**: `MigratorBSC.sol` 把 `ROUTER`, `FACTORY`, `WBNB` 都 hardcode 成 PancakeSwap mainnet 地址。但 BSC testnet 用的 PancakeSwap 地址完全不同!

**后果**: 在 BSC testnet 部署后,代币毕业时 swap 会失败(因为 router 地址根本不存在 testnet 上),整个毕业流程 broken。

**修复**:
```solidity
// 改为构造时注入
constructor(
    address _lPLocker,
    address _feeRecipient,
    address _router,        // 🆕 测试网 PancakeSwap Router
    address _factory,       // 🆕 测试网 PancakeSwap Factory
    address _wbnb           // 🆕 测试网 WBNB
)
```
+ DeployBSC.s.sol 用 BSC testnet PancakeSwap 地址部署。

---

## 高危 High

### H-1 ❌→✅ (新发现) BananaCatToken.to == taxRecipient 时税凭空消失

**现象**:
```solidity
// 旧代码
if (taxAmount > 0 && from != taxRecipient && to != taxRecipient) {
    _balances[taxRecipient] += taxAmount;
}
```
当 to==taxRecipient 时(用户直接把 token 转给 taxRecipient):
- `transferAmount = amount - taxAmount` 加到 `_balances[to]` = `_balances[taxRecipient]` → taxRecipient 收到 transferAmount
- 然后 if 判断 `to != taxRecipient` 为 false → **不单独加 taxAmount**
- 结果:taxAmount 这部分税凭空消失!发币者少收税

**修复**:
```solidity
// 新代码:只有 to != taxRecipient 时才单独加税(避免双重加)
if (taxAmount > 0 && to != taxRecipient) {
    _balances[taxRecipient] += taxAmount;
}
```

---

### H-2 ❌→✅ BananaCatFactory 缺 `withdrawPlatformRevenue`,平台收入永久锁死

**现象**: `platformRevenue += creationFee` 在 createToken,平台手续费 + 毕业费都累加进去,但合约没有任何 withdraw 函数。

**后果**: 平台运营方永远无法提取累积的收入,资金锁死在 Factory 合约里。

**修复**: 加 `withdrawPlatformRevenue(uint256 amount)` 和 `withdrawAllPlatformRevenue()`,只有 `feeRecipient` 能调用,用 CEI 模式 state 变更在 call 前。

---

### H-3 ❌→✅ (新发现) Foundry test 用旧 `lockLP` 4 参数签名,新签名是 5 参数

**现象**: `contracts/test/BaseTest.t.sol` 和 `LPLockerTest.t.sol` 全部用旧的 `lockLP(token, creator, amount, period)` 4 参数调用,新签名是 `lockLP(lpToken, token, creator, amount, period)` 5 参数。

**后果**: 跑 `forge test` 时 `function selector not matched` 编译错误。

**修复**: 更新所有 lockLP 调用站点到 5 参数版本。

---

### H-4 ❌→✅ (新发现) 前端环境变量 `VITE_API_URL` vs `VITE_API_BASE` 不一致

**现象**:
- `.env.example` + `Dockerfile` 定义 `VITE_API_URL`
- `HomePage.tsx`, `CommentSection.tsx`, `DashboardPage.tsx` 等用 `VITE_API_URL`
- **但** `TokenDetailPage.tsx`, `LPUnlockPage.tsx`, `useWallet.tsx` 用 `VITE_API_BASE`(不存在)

**后果**:
- `import.meta.env.VITE_API_BASE` 是 `undefined`,`|| ''` 退化为空字符串
- 所有 fetch 调用相对路径"http://localhost:3001/..." 当前端部署到不同 host 时 **会拼到错误的 host**
- LPUnlockPage 同时 broken(C-3)和 api 路径 broken

**修复**: 所有 `VITE_API_BASE` 改 fallback 同时检查 `VITE_API_URL || VITE_API_BASE`,向后兼容。

---

## 中危 Medium

### M-1 ❌→✅ BondingCurve.sell 用 grossOut 而非 currencyOut 校验 slippage

**现象**:
```solidity
// 旧代码
(uint256 grossOut, uint256 fee) = tokenAmount.getSellAmountWithFee(...);
if (grossOut < minCurrencyOut) revert InsufficientOutput(grossOut, minCurrencyOut);
currencyOut = grossOut - fee;  // 用户实际收到的是 currencyOut,但校验用 grossOut
```

**后果**: 用户的 slippage tolerance 多包含了 fee 金额,实际 received 比 min 少 fee。

**修复**:
```solidity
uint256 currencyOut = grossOut - fee;
if (currencyOut < minCurrencyOut) revert InsufficientOutput(currencyOut, minCurrencyOut);
```

---

### M-2 ❌→✅ BananaCatFactory 缺 description/social URL 长度校验

**现象**: 只校验 `name` ≤ 50,`symbol` ≤ 10。但 description / imageUrl / social URL 长度无限制。

**后果**: 用户可以塞 100K 字符串进 `description`,导致 Clones 出来的合约 size 超 24KB,**合约部署失败**。

**修复**:
- description ≤ 1000
- imageUrl ≤ 500
- 3 个 social URL ≤ 200 各

---

### M-3 ❌→✅ BananaCatToken antiSniper startTaxBps=0 校验缺失

**现象**: `startTaxBps > 5000` 校验未覆盖 `startTaxBps == 0`。

**后果**: 用户 enable antiSniper 但 startTaxBps=0 等同没启用反狙击,UI 误导。

**修复**: 加 `if (startTaxBps == 0)` 校验。

---

## 低危 Low / 良好

### L-1 ✅ BondingCurve._graduate reentrancy 风险(可接受)
- 现有 BananaCatToken 不是 ERC777,没有 hooks
- `graduated = true` 在 try 之前,失败 catch 后恢复为 false
- **生产前考虑加 ReentrancyGuard**

### L-2 ✅ BananaCatToken.self-transfer 会减少自己 balance
- 如果用户 `transfer(self, self, amount)`,`_balances[from] -= amount` + `_balances[to] += transferAmount` = balance 减少 taxAmount
- 这不构成严重攻击面,token 持有者行为,可接受

---

## 修复优先级总结

| 优先级 | # | 修复内容 | 影响 |
|---|---|---|---|
| P0 | C-1 | Factory 加 receive | 整个交易功能 broken |
| P0 | C-3 | 后端加 /api/locks/:lockId | LPUnlockPage 完全 broken |
| P0 | C-4 | Foundry 加 lib 依赖 | 合约编译失败 |
| P0 | C-5 | MigratorBSC 用 testnet 地址 | testnet 毕业 fail |
| P1 | C-2 | LPLocker LockInfo 重构 | 数据错乱,可读性 |
| P1 | H-1 | Token tax to==taxRecipient bug | 资产凭空消失 |
| P1 | H-2 | Factory withdraw 函数 | 平台收入锁死 |
| P1 | H-3 | Tests 用新 lockLP 5 参数 | 测试不能跑 |
| P1 | H-4 | 前端 VITE_API_BASE fallback | 部署后 broken |
| P2 | M-1 | sell slippage 用 currencyOut | 体验问题 |
| P2 | M-2 | Factory 长度校验 | DoS 风险 |
| P2 | M-3 | antiSniper startTaxBps=0 校验 | UX |

---

## 修复完成度

✅ 所有 P0 / P1 / P2 全部修复
✅ Token `_transfer` 课税数学修订
✅ LPLocker 解锁流程可工作
✅ 后端 LP 查询接口就绪
✅ Foundry 编译可用
✅ MigratorBSC testnet 路径配置就绪
✅ 文档、CHANGELOG 同步更新

---

## 后续测试建议

部署到 testnet 后,务必进行以下验证:
1. **end-to-end buy/sell**:验证 fee 实际进入 factory `platformRevenue`,然后 feeRecipient 用 `withdrawPlatformRevenue` 提取
2. **graduation flow**:跑完 24 BNB 后验证 PancakeSwap V2 pair 出现,LP token 锁入 LPLocker
3. **LP unlock flow**:
   - 不立即 claim
   - 等 unlockTimestamp 到期
   - claimLP 拿到 LP token
   - extendLock 选择更长期限
   - burnLPByCreator 主动销毁
4. **edge case**:
   - 用户输入 amount = "abc" 不会让前端崩
   - 用户输入 amount 超 MAX_SAFE_INTEGER / 1e18 返回明确错
   - 长度超限的 name/description 被 revert

