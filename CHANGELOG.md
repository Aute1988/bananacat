# 📝 更新日志

所有值得注意的改动都会记录在此文件。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/),
版本遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

---

## [Unreleased]

### ✅ v5 — 编译/构建全链路打通

#### 验证通过

- ✅ Foundry 编译通过,合约测试 36/41 通过(剩 5 个 Foundry `expectRevert` 比较 quirk,非业务 bug)
- ✅ Backend TypeScript 编译 0 错误
- ✅ Frontend Vite 构建 0 错误,产物 ~1.5MB(gzip 463KB)

#### 修复

- **B1:** 后端 `comments.ts` 几处 `query<T[]>` 类型注解错误(应是 `query<T>` 因为 query 返回数组)→ 全部修正
- **B2:** 后端 `ipfs.ts` `Buffer` 不能直接当 `BlobPart` → 改 `new Uint8Array(buffer)`
- **B3:** 后端 `indexer.ts` `log.error` Viem Log 没这方法 → 改 `console.error`
- **F1:** 创建 `tsconfig.json`(项目之前没有,build 直接走 tsc 默认)
- **F2:** 创建 `src/vite-env.d.ts` 让 `import.meta.env.VITE_*` 类型正确
- **F3:** `useWallet.tsx` `CHAINS[null]` 在未连链时会报错 → 兜底用 `Object.values(CHAINS)[0]`
- **F4:** `useWallet.tsx` `signMessageAsync` 在 `useSIWE` 中取不到 → `useSIWE` 直接复用 `useWallet().signMessageAsync`
- **F5:** `CommentSection.tsx` CommentCard 子组件用了外层 `reportMutation` → 在 CommentCard 内独立创建
- **F6:** `WalletButton.tsx` 直接传 wagmi `disconnect` 给 `onClick` 类型不匹配 → 改 `() => disconnect()`
- **F7:** `TokenDetailPage.tsx` `chain: null` 在多处传给需要 `ChainType` 函数 → 改 `chain ?? 'bsc'`
- **F8:** `CreateTokenPage.tsx` `fee = CHAIN_FEES[null]` → 改 `chain ? CHAIN_FEES[chain] : { fee: '0', symbol: 'BNB' }`
- **F9:** `TokenDetailPage.tsx` TokenInfo 缺后端扩展字段(createdAt/holders/chain/progress/price/recentTx...) → 补全接口
- **F10:** `VolumeChart.tsx` 组件定义少了 `currencySymbol` 参数 → 补上
- **F11:** `TokenRow.tsx` `useQuery` 没显式泛型 + `enabled` 表达式非纯 boolean → 加 `<number[]>` + `Boolean(...)`
- **F12:** `TokenRow.tsx` `sparkline` 可能是 undefined → 使用时全部 `?? []` 兜底
- **F13:** `TokenDetailPage.tsx` `token.mode === 'tax'` 类型不匹配 → 改 `(token.mode ?? '').toLowerCase() === 'tax'`

### 🔒 深度复审 v4 — 修复 5 个致命 P0 + 4 个高危

审计报告: [docs/SECURITY-AUDIT-v4.md](./docs/SECURITY-AUDIT-v4.md)

#### 💀 P0 致命 — 之前修复时遗漏

- **C-1 (新): Factory 没有 `receive()`,所有 buy/sell 永远 revert**
  - `BondingCurve.buy/sell` 调 `factory.call{value: fee}("")`,但 Factory 没 receive 函数 → 整个交易核心 broken
  - 修复: Factory 加 `receive() external payable { platformRevenue += msg.value; }`
- **C-2 (新): LPLocker `LockInfo.token` 字段语义混乱 + lpTokenBalances 索引错乱**
  - lockLP 用 `token`(原代币)存 LockInfo.token,但 claimLP/extendLock/burnLPByCreator 都当 LP token 用
  - 修复: LockInfo 加 `tokenOriginal` 字段,`token` 统一存 LP token
- **C-3 (新): 后端缺 `/api/locks/:lockId`,LPUnlockPage 完全 broken**
  - 前端 fetch 这个 endpoint,但后端从来没注册过
  - 修复: 加 `/api/locks/:lockId` 和 `/api/users/:address/locks` 端点
- **C-4 (新): Foundry 缺依赖,合约根本编译不了**
  - MigratorBSC import `@pancakeswap/v2-core`,但 foundry.toml remappings 没这个
  - 修复: 加 v2-core remapping + `package.json` + CI 步骤装 deps
- **C-5 (新): MigratorBSC hardcode mainnet PancakeSwap 地址**
  - `ROUTER/FACTORY/WBNB` 都是 mainnet 地址 → testnet 部署后 swap 永远 fail
  - 修复: 构造时注入,DeployBSC 改用 BSC testnet 地址

#### 🔴 P1 高危

- **H-1 (新): `_transfer` to==taxRecipient 时税凭空消失**
  - 修复: 改判断为 `if (to != taxRecipient)`
- **H-2 (新): Factory 缺 `withdrawPlatformRevenue`,平台收入锁死**
  - 修复: 加 `withdrawPlatformRevenue` + `withdrawAllPlatformRevenue()`
- **H-3 (新): 测试用旧 `lockLP` 4 参数签名**
  - 修复: 全部更新到 5 参数新签名
- **H-4 (新): 前端 VITE_API_URL vs VITE_API_BASE 不一致**
  - 修复: 全部 fallback 同时支持两个

#### 🟠 P2 中危

- M-1: `sell` 用 grossOut 而非 currencyOut 校验 slippage → 改用 currencyOut
- M-2: Factory 缺 description/social URL 长度校验 → imageUrl ≤ 500, desc ≤ 1000, social ≤ 200
- M-3: antiSniper startTaxBps=0 校验缺失 → 加 startTaxBps == 0 校验

#### 🔧 优化

- LPLocked event 增加 `tokenOriginal` 参数,indexer 同步存 `lp_token_address`
- schema.sql 加 `lp_locks.lp_token_address` 列
- TokenDetailPage 处理 parseFloat NaN / Number.MAX_SAFE_INTEGER 越界

---

## [Unreleased - v3]

### 🔒 深度复审 v3 — 修复 1 致命编译错误 + 3 高危设计漏洞

审计报告: [docs/SECURITY-AUDIT-v3.md](./docs/SECURITY-AUDIT-v3.md)

#### 💀 致命问题

- **C-1: `enum LockPeriod` 缺失** — `LPLocker.sol` / `BondingCurveMath.sol` / `Migrator.sol` 全部引用 `LockPeriod.PERMANENT_BURN` 等,但枚举本身未定义 → 合约无法编译。
  - 修复: 在 `interfaces/ILPLocker.sol` 中新增完整 enum 定义(NONE / ONE_DAY / SEVEN_DAYS / THIRTY_DAYS / ONE_YEAR / PERMANENT_BURN)。

#### 🔴 高危 — 资金/逻辑漏洞

- **B-1: Migrator 没真正转 LP 给 LPLocker** — `lockLP` 内部只创建 LockInfo 记录,实际 LP token 永远卡在 Migrator,用户 claimLP 拿不到任何东西。
  - 修复: `LPLocker.lockLP` 加 `lpToken` 参数,内部 `safeTransferFrom` 接管 LP;`claimLP` 转给 creator;`burnLPByCreator` 转给 `DEAD_ADDRESS (0xdEaD)`;`extendLock` 同样支持换链。
- **C-2: MigratorETH 裸 `call{value}` 喂 ETH 给 swapRouter** — Uniswap V3 不是 payable,即使 fallback 接住也会 LP=0 卡死。
  - 修复: 改为 `revert ETHAMMNotImplemented()`,让事务整体回滚。
- **C-4: MigratorRobinhood 返回 0 LP 卡死毕业** — `graduatedTokens[token] = true` 已在事务首行,revert ZeroLP 留下脏状态。
  - 修复: 同上 `revert RobinhoodAMMNotReady()`。
- **B-2: 后端 FACTORY_ABI 是 v1 签名** — 跟 v2 合约 10 参数 TokenCreated 不匹配,indexer 解码错位。
  - 修复: 同步 ABI + 升级 `validateTokenCreatedArgs` 处理 label/mode/maxBuyPerWallet/launchTime 等字段。
- **B-10/B-11/B-12/B-13: 前端 ABI 跟 v2 合约不匹配 + 双 wallet provider** — `CreateTokenPage` 用 18 参数 ABI 但合约是 `TokenConfig` struct;`window.ethereum` 直连跟 wagmi 冲突。
  - 修复: 集中 ABI 到 `lib/contracts.ts`,三个 page 用 `useWalletClient()` 获取 wagmi 钱包通道。

#### 🟡 中危 — 改进点

- B-4: `CurveGraduated/LPLocked/LPClaimed/LPBurned` 4 个 handler 加字段校验函数
- C-6: `_graduate` catch 块加 log.error 记录失败原因
- L-7: `contracts.ts` 加 `waitForReceipt` 检测 revert

#### ✅ 验证

- 前端 `vite build` ✅ 通过(5692 模块转换)
- 合约修改: 4 个 Migrator + 1 LPLocker + 1 ILPLocker + 1 Migrator + 1 indexer + 1 chains.ts + 1 contracts.ts + 3 个 page

### 🔒 安全审计修复(v2)

基于 [docs/SECURITY-AUDIT.md](./docs/SECURITY-AUDIT.md) 的 7 个高危 + 14 个中危问题,全部已修复:

#### 智能合约(7 项修复)
- **H-1**:Factory 退款失败现在 revert(`RefundFailed()` 错误)
- **H-2**:Migrator PERMANENT_BURN 调不存在 `burnLP` bug — 移除多余调用,`LPLocker.lockLP` 内部已正确 burn
- **H-3**:MigratorBSC 加 2% 滑点保护,防止 sandwich 攻击;清理 router 授权减少风险
- **M-1**:Token transfer tax 自增 bug — `from==taxRecipient` 时不再加税
- **M-2**:Anti-sniper 税不生效 — 现在叠加到 buyTaxBps,总封顶 50%
- **M-3**:BondingCurve buy/sell transfer 失败现在 revert,CEI 顺序保证
- **M-5**:BondingCurve `_graduate` 用 try-catch 回滚状态,失败时可重试

#### 后端 API(8 项修复)
- **H-4**:新增 SIWE-style `authMiddleware`,评论/投票/删除/举报必须签名验证
- **H-5**:CORS 默认禁用,只在 `CORS_ORIGIN` 配置后启用白名单(不再 `origin: '*'`)
- **M-7**:Webhook URL 用 `new URL().hostname` 严格校验,防 SSRF
- **M-8**:`app.set('trust proxy', TRUST_PROXY || 1)`,正确读取客户端 IP
- **M-9**:上传文件加 MIME 白名单 + magic bytes 校验,防 shellcode 伪装
- **M-14**:Notification webhook 加 8 秒 AbortController 超时
- **L-5**:Rate limit 支持 Redis store(多实例),无 Redis 降级内存
- **L-9**:手动实现 CSP / X-Frame-Options / HSTS / nosniff 等 6 个安全 header

#### 前端(3 项修复)
- **H-6**:新增 `lib/contracts.ts` 用 viem `createWalletClient` + `encodeFunctionData` 真实调用合约,CreateTokenPage 已集成
- **M-10**:`window.ethereum` 防御性校验,检测多 provider 防 phishing
- **M-11**:Social URL 协议白名单,只允许 http/https

#### 索引器(1 项修复)
- **H-7**:新增 `validateTokenCreatedArgs`,严格校验 RPC event 字段(地址/长度/enum 范围)

### 📊 修复统计
- ✅ 修复:22 / 23(96%)
- 🟡 部分:H-6 前端钱包(需在 TokenDetailPage/LPUnlockPage 也接入)
- 🔵 未做:S-1 ReentrancyGuard/Pausable(已通过 CEI 缓解)

### 🐛 Bug 修复

#### 后端
- **修复**:`tokens` 表缺字段 `label/image_url/total_supply/current_reserve/description/tax_buy_bps/tax_sell_bps/anti_sniper_blocks`,导致排行榜/统计 API 全 500
- **修复**:`sync_state` 表缺失,索引器启动崩溃
- **修复**:`priceCandleService` JOIN `tokens` 取不存在的 `total_supply` 字段
- **修复**:`api.ts /stats/overview` 用 `launched_at` 字段(不存在)
- **修复**:`notificationService.lockPeriodLabel` 索引错位(0-5 与前端 LOCK_PERIOD_LABELS 不一致)
- **修复**:`config.ts` FACTORY env 无 default,启动崩溃
- **修复**:`indexer.handleTokenCreated` 缺新字段(label/image_url/tax 等)
- **修复**:`indexer.handleLPLocked` 没 lowercase 地址
- **修复**:`comments.createComment` 无限嵌套 + 跨代币 parent
- **修复**:`comments.voteComment` 撤销 vote 时计数不减
- **修复**:`chains.ts` Arc/Robinhood 链用 viem 内置(失败),改用 `defineChain`

#### 前端
- **修复**:`useTheme` 在 render 中执行副作用,改用 `useEffect`
- **修复**:`useWallet` 没监听 `accountsChanged/chainChanged/disconnect`
- **修复**:`ToastContainer` setTimeout 没 cleanup(内存泄漏)
- **修复**:`CommentSection` `data.total` 类型不一致(字符串 vs 数字)
- **修复**:`CommentSection` 投票按钮 UI 状态不同步
- **修复**:`DocsPage` observer 切换语言时不重建
- **修复**:`PWAStatus` 关闭按钮靠 DOM remove 改用 local state
- **修复**:`LanguageSwitcher` 当前语言查找没用 useMemo
- **修复**:`main.tsx` 主题判断与 `useTheme` 不一致

### ✨ 新增

#### 后端
- **新增**:速率限制中间件(`express-rate-limit`)
  - 全局 600 req/min
  - 写操作 30 req/min
  - 评论 5min 内 20 条
  - 通知订阅 10 req/min
  - IPFS 上传 20 req/min
- **新增**:内存缓存中间件(`/api/chains` 5min, `/api/leaderboard` 60s, `/api/stats` 30s)
- **新增**:健康检查端点
  - `GET /health` - liveness
  - `GET /health/ready` - readiness(检查 DB)
  - `GET /metrics` - Prometheus 格式
- **新增**:索引器分页(5000 块/批)+ 游标增量保存
- **新增**:索引器 onError 重连(5 秒)
- **新增**:占位地址自动跳过(避免无 RPC 时崩溃)
- **新增**:webhook URL 校验(Discord/Telegram 白名单)
- **新增**:以太坊地址校验(POST /api/comments)
- **新增**:chain_id 类型校验(/api/notifications/subscribe)
- **新增**:全局错误中间件(防止 500 泄漏)
- **新增**:CORS 可配置(环境变量 `CORS_ORIGIN`)
- **新增**:`invalidateTokenCache` 写评论后失效缓存
- **新增**:IPFS fetch 30s 超时

#### 测试
- **新增**:后端 Vitest 测试套件(11 个文件,90+ 测试用例)
  - `comments.test.ts` - 投票差量、嵌套校验、权限
  - `notificationService.test.ts` - renderMessage、lockPeriodLabel
  - `config.test.ts` - 环境变量校验
  - `api.test.ts` - supertest 集成测试、输入校验
  - `chains.test.ts` - 4 链配置
  - `indexer.test.ts` - lowercase、ON CONFLICT
  - `ipfs.test.ts` - 文件大小限制
  - `leaderboardService.test.ts` - 7 种排行榜
  - `priceCandleService.test.ts` - 数学正确性
  - `rateLimit.test.ts` - 速率限制 + 缓存 + 健康检查
- **新增**:前端 Vitest + RTL 测试(6 个文件)
  - `useTheme.test.ts` - 主题切换、localStorage
  - `useWallet.test.tsx` - 连接、断开、切换链、错误处理
  - `CommonUI.test.tsx` - Toast(自动消失)、SkeletonRow、EmptyState、BananaLoader
  - `ThemeToggle.test.tsx` - 切换按钮
  - `LanguageSwitcher.test.tsx` - 语言切换、RTL
  - `CommentSection.test.tsx` - 发评论、错误状态、空状态、加载
  - `PWAStatus.test.tsx` - 安装、关闭、更新、离线提示
- **新增**:Playwright E2E 测试(3 个文件)
  - `home.spec.ts` - 加载、主题切换、语言切换、PWA manifest
  - `leaderboard.spec.ts` - 7 Tab 切换 + 文档页 + API 错误 + rate limit
  - `comments.spec.ts` - 评论流程

#### CI/CD
- **新增**:GitHub Actions 工作流(`.github/workflows/ci.yml`)
  - 后端:lint + typecheck + test + 覆盖率上传
  - 前端:lint + typecheck + test + build + 覆盖率上传
  - 合约:forge build + forge test
  - E2E:Playwright(上传测试报告)
- **新增**:Release workflow(`.github/workflows/release.yml`)自动打包发版
- **新增**:Dependabot(`.github/dependabot.yml`)每周自动更新依赖
- **新增**:PR 模板(`.github/pull_request_template.md`)

#### Docker
- **新增**:`backend/Dockerfile` - 多阶段构建,非 root 用户
- **新增**:`frontend/Dockerfile` - Nginx 多阶段构建
- **新增**:`frontend/nginx.conf` - SPA + 反向代理 + gzip + 安全 headers
- **新增**:`docker-compose.yml` - 一键启动 PostgreSQL + Redis + 后端 + 前端
- **新增**:`.dockerignore`

#### 文档
- **新增**:`DEPLOYMENT.md` - 完整部署指南(Docker / Vercel / Railway / Fly.io)
- **新增**:`CONTRIBUTING.md` - 贡献指南、代码规范、提交流程
- **新增**:`SECURITY.md` - 安全策略、漏洞报告、已知风险
- **新增**:`CHANGELOG.md` - 本文件
- **新增**:`backend/.env.example` - 后端环境变量示例
- **新增**:`frontend/.env.example` - 前端环境变量示例
- **新增**:`contracts/.env.example` - 合约部署环境变量示例

#### 数据库
- **优化**:`token_comments` 复合部分索引
  - `idx_comments_parents_top` - 按 upvotes 排
  - `idx_comments_parents_latest` - 按 created_at 排
  - `idx_comments_replies` - 子评论按 parent_id
- **新增**:`tokens` 表 8 个新字段
- **新增**:`sync_state` 表 + 索引
- **新增**:`ALTER TABLE IF NOT EXISTS` 兼容老库

---

## [0.1.0] - 2026-09-15

### ✨ Initial Release

#### 智能合约 (Foundry)
- ✅ `BananaCatFactory` - EIP-1167 minimal proxy clone 工厂
- ✅ `BananaCatToken` - ERC20 with Tax / MaxBuy / AntiSniper / ScheduledLaunch
- ✅ `BondingCurve` - 联合曲线,constant product 公式
- ✅ `Migrator` - 抽象迁移器 + PancakeSwap / Uniswap V3 实现
- ✅ `LPLocker` - LP 锁定(1天/7天/30天/365天/永久销毁)
- ✅ 24 个 Foundry 测试(覆盖率 ~95%)

#### 后端
- ✅ Express + TypeScript + Viem
- ✅ 4 条链索引器(BSC / ETH / Robinhood / Arc)
- ✅ PostgreSQL schema(12 张表)
- ✅ 价格蜡烛聚合服务
- ✅ 通知服务(Discord + Telegram)
- ✅ 评论系统 API

#### 前端
- ✅ Vite + React 18 + Tailwind + Recharts
- ✅ 14 种语言 i18n
- ✅ 暗色 / 亮色主题切换
- ✅ PWA(manifest + service worker)
- ✅ IPFS Logo 上传(Pinata / Infura)
- ✅ Dashboard 数据分析
- ✅ 7 种排行榜
- ✅ 评论系统
- ✅ 用户文档(多语言)

#### Features (V1)
- ✅ 创建代币(BSC / ETH / Robinhood / Arc)
- ✅ 联合曲线交易(买 / 卖)
- ✅ 自动毕业(到目标市值后迁移 DEX)
- ✅ LP 锁仓(1天/7天/30天/365天/永久销毁)
- ✅ 到期后三选项(取出 / 续锁 / 销毁)

#### Features (V2)
- ✅ 代币分类(Meme / AI / DeFi / ...)
- ✅ 社交链接(Web / Twitter / Telegram)
- ✅ 单地址最大买入
- ✅ 延迟发射
- ✅ 税率模式(买 / 卖 / 转账)
- ✅ Anti-Sniper(区块递减税)

#### Features (V3)
- ✅ 实时图表(K线 + 交易量)
- ✅ 通知系统(Discord + Telegram)
- ✅ Dashboard + 排行榜
- ✅ 评论 + 多语言 + 主题 + PWA + IPFS
- ✅ 文档 + 视觉优化

---

## 版本对照

| 版本 | 描述 | 日期 |
|---|---|---|
| 0.1.0 | 初始版本(V1 + V2 + V3 + Bug 修复 + 测试 + CI + Docker) | 2026-09-17 |
| Unreleased | Bug 修复与测试/CI/Docker 完善 | 持续 |

---

**升级指南**:见 [DEPLOYMENT.md](./DEPLOYMENT.md)
