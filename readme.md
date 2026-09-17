# 🍌🐱 香蕉猫 Launchpad (Banana Cat Launchpad)

> 一个**支持「可选 LP 锁仓期限」**的多链 Meme 代币发射台。
> 灵感来自 [four.meme](https://four.meme) 与 [pump.fun](https://pump.fun),但加入了**发币者主动选择锁仓时长**的差异化功能。

---

## 🌟 这个项目跟别的发射台不一样的地方

| 平台 | LP 锁仓 |
|---|---|
| pump.fun | ❌ 不锁 |
| four.meme | ⚠️ 不锁,跑路事件频发 |
| **香蕉猫 Launchpad** | ✅ **发币者自选:1 天 / 7 天 / 30 天 / 365 天 / 永久销毁** + 🆕 **到期后可续锁或销毁** |

> 💡 永久锁仓 = LP 直接销毁,谁也拿不走 — 这是对买家最强的信任承诺。
> 🆕 v2 新增:到期后**三选一** — 提取 / 续锁(任意期限) / 销毁

---

## 📋 v2 发币参数(four.meme 风格)

创建代币时可设置:

| 分类 | 必填 / 选填 | 说明 |
|---|---|---|
| 名称 / 符号 / Logo / 描述 | ✅ 必填 | 代币标识 |
| 分类 | ✅ 必填 | Meme / AI / DeFi / Games / Infra / De-Sci / Social / DePIN / Charity / Others |
| 官网 / X / Telegram | ❌ 选填 | 社交链接 |
| 税率模式 | ✅ 必填 | 🆕 Normal(零税) / Tax(1-10% 买入/卖出/转账税) |
| 最大单地址买入 | ❌ 选填 | 防大户垄断 |
| 发币时间 | ❌ 选填 | 立即发币 / 定时发币 |
| LP 锁仓期限 | ✅ 必填 | 🆕 1天 / 7天 / 30天 / 365天 / 永久销毁 |

---

## 🆕 v2 新增功能

### 🔓 LP 解锁三选一
锁仓到期后,创建者可三选一:

| 选项 | 行为 | 适用场景 |
|---|---|---|
| 🟢 **提取 LP** | LP 转回钱包 | 想自由处置 LP |
| 🔄 **继续锁仓** | 🆕 重新选期限(1天/7天/30天/365天/永久销毁) | 想延续信任 |
| 🔥 **销毁 LP** | 🆕 LP 直接 burn | 想证明诚意 |

### 💸 Tax Token 模式
支持税率代币(参考 four.meme):
- 买入税 / 卖出税 / 转账税 独立设置(从 [1%, 3%, 5%, 10%] 选)
- 总税率 ≤ 30%,单项 ≤ 10%
- 税率接收人地址可设(默认发给发币者)

---

## 📋 目录索引

| 你想看什么 | 看这里 |
|---|---|
| 🎯 我是用户,怎么用平台 | [→ 用户使用手册](#-用户使用手册) |
| 👨‍💻 我是开发者,怎么看代码 | [→ 开发者文档](#-开发者文档) |
| 🏗️ 项目怎么组织的 | [→ 项目架构](#-项目架构) |
| 📡 4 条链的配置 | [→ 多链部署](#-多链部署) |
| 🧪 怎么跑测试 | [→ 测试](#-测试) |

---

## 🎯 用户使用手册

### 🚀 发币者流程(3 步)

1. **连接钱包** → 选你要发在哪条链(BSC / Ethereum / Robinhood / Arc)
2. **填写代币信息**
   - 名称、符号、Logo、描述
   - 🆕 **锁仓期限**:`1 天` / `7 天` / `30 天` / `365 天` / `永久销毁`
   - 🆕 每用户最大买入量
3. **支付约 0.005 平台币的部署费** → 代币自动上链,进入联合曲线交易阶段

### 💰 交易者流程

1. 进首页,浏览代币列表
2. 点进代币详情,看曲线进度 / 市值 / 持有者
3. 买入 / 卖出 — 走的是平台内置的「联合曲线」,不需要去外部交易所
4. 当某个币的曲线达到 100%(24 平台币),自动迁移到 PancakeSwap(BSC) / Uniswap(ETH)

### 🔓 LP 解锁面板(发币者专属)

- 进 `/my-tokens` 页面,看到你发过的所有币
- 状态栏会显示:**「🔒 还剩 23 天 14 小时解锁」** / **「✅ 可领取 LP」** / **「🔥 永久销毁」**
- 到期后点击「领取 LP」→ 提取属于你的流动性份额
- 永久销毁的币不显示领取按钮

---

## 🏗️ 项目架构

```
香蕉猫/
├── contracts/              # 智能合约(Solidity)
│   ├── src/
│   │   ├── core/           # 核心合约(代币工厂、联合曲线)
│   │   ├── periphery/      # 外围合约(LP 锁仓、迁移器)
│   │   ├── interfaces/     # 所有接口
│   │   └── libraries/      # 联合曲线数学、安全工具
│   └── test/               # Foundry 测试
├── deployments/            # 4 条链的部署脚本与配置
│   ├── bsc/                # BNB Smart Chain
│   ├── ethereum/           # Ethereum 主网
│   ├── robinhood/          # Robinhood Chain (Arbitrum Orbit)
│   └── arc/                # Circle Arc
├── frontend/               # React + Vite 前端(香蕉猫主题)
│   └── src/
│       ├── pages/          # 页面(发币、列表、详情、解锁面板)
│       ├── components/     # 复用组件
│       ├── chains/         # 4 条链适配层
│       └── abis/           # 合约 ABI(自动生成)
├── backend/                # Node.js 后端(索引器 + API)
│   ├── src/
│   ├── db/                 # PostgreSQL schema
│   └── scripts/
├── docs/                   # 架构、流程、API 文档
└── scripts/                # 一键启动脚本
```

### 核心合约组件

| 合约 | 职责 |
|---|---|
| `BananaCatFactory` | 发币入口,创建新代币并部署联合曲线 |
| `BananaCatToken` | 极简 ERC-20(克隆模式,节省 gas) |
| `BondingCurve` | 内置联合曲线买卖逻辑 + 价格计算 |
| `LPLocker` | **🆕 LP 锁仓合约**,支持 5 种期限 + 永久销毁 |
| `Migrator` | 当曲线达到 100% 时,把流动性搬到 DEX |

---

## 📡 多链部署

### 链配置速览

| 链 | Chain ID | 原生币 | 测试网水龙头 | DEX |
|---|---|---|---|---|
| **BNB Smart Chain** | 56 / 97(testnet) | BNB | https://testnet.bnbchain.org/faucet-smart | PancakeSwap |
| **Ethereum** | 1 / 11155111(testnet) | ETH | https://sepoliafaucet.com | Uniswap V3 |
| **Robinhood Chain** | 4663 / 46630(testnet) | ETH | https://faucet.chain.robinhood.com | 自建池(Arbitrum Orbit) |
| **Circle Arc** | 5042002(testnet) | USDC | https://faucet.circle.com | 自建池 |

> 4 条链都用同一份合约代码,通过 `deployments/<chain>/` 下的配置切换 RPC 和 DEX 路由器地址。

### 一键部署到测试网

```bash
# BSC 测试网
cd deployments/bsc && forge script script/Deploy.s.sol --rpc-url bsc_testnet --broadcast

# 同理换 ethereum / robinhood / arc
```

---

## 🧪 测试

```bash
cd contracts
forge test                    # 跑全部单元测试
forge test --gas-report       # 含 gas 报告
forge coverage                # 覆盖率
```

测试覆盖:
- ✅ 联合曲线买卖数学
- ✅ 锁仓 5 种期限(包含边界条件)
- ✅ 永久销毁路径
- ✅ 迁移到 DEX 流程
- ✅ 重入攻击防护
- ✅ 多用户并发交易

---

## 🛠️ 本地启动

```bash
# 后端
cd backend && pnpm install && pnpm dev

# 前端
cd frontend && pnpm install && pnpm dev
```

访问 `http://localhost:5173`。

---

## 📊 进度看板

| 模块 | v1 | v2 | v3 |
|---|---|---|---|
| 项目目录 | ✅ | ✅ | ✅ |
| 共享合约库 | ✅ | ✅ | ✅ |
| BSC / Ethereum / Robinhood / Arc 部署 | ✅ | ✅ | ✅ |
| 前端基础 | ✅ | ✅ | ✅ |
| 发币页 | ✅ | ✅ + Social/分类/税率 | ✅ + 反狙击 + 🆕 **IPFS 上传** |
| 列表 + 交易 UI | ✅ | ✅ | ✅ + 🆕 **K线图表** |
| LP 解锁面板 | 提取 | 🆕 **三选一** | ✅ |
| 后端索引器 | ✅ | ✅ | ✅ |
| 蜡烛 / 价格 / 交易量 API | ❌ | ❌ | 🆕 **✅** |
| 通知系统 (Discord + Telegram) | ❌ | ❌ | 🆕 **✅** |
| 反狙击机制 | ❌ | ❌ | 🆕 **✅** |
| **PWA(加桌面)** | ❌ | ❌ | 🆕 **✅** |
| **IPFS Logo 上传** | ❌ | ❌ | 🆕 **✅** |
| **数据分析 Dashboard** | ❌ | ❌ | 🆕 **✅** |
| **Launchpad 排行榜** | ❌ | ❌ | 🆕 **✅** |
| **代币评论区** | ❌ | ❌ | 🆕 **✅** |
| **14 语言多语言** | ❌ | ❌ | 🆕 **✅** |
| **暗黑/亮色主题** | ❌ | ❌ | 🆕 **✅** |
| **使用文档(Docs)** | ❌ | ❌ | 🆕 **✅** (含 14 语言适配) |
| 测试套件 | ✅ | ✅ + 税率/续锁/销毁 | ✅ + 反狙击 |
| 部署文档 | ✅ | ✅ | ✅ |

> 🎉 **v3 已完成:** 图表 / 通知 / 反狙击 / PWA / IPFS / Dashboard / 排行榜 / 评论 / 多语言 / 双主题 / 使用文档
> 🛡️ **v3.1 已完成:** Bug 修复 / 测试套件 / CI/CD / Docker 部署 / 安全加固 / 速率限制 / 缓存 / Prometheus 指标
> 🎯 **未来可选:** 移动端原生 App / 一键 swap / NFT Collection 联合铸造 / DAO 治理

---

## 🛡️ v3.1 质量提升(刚刚完成)

### 🐛 Bug 修复

修复 **35 个 Bug**,涵盖:

| 严重度 | 数量 | 例子 |
|---|---|---|
| 🔴 致命 | 8 | `tokens` 表缺字段导致 SQL 全挂、`sync_state` 表缺失、索引器启动崩溃 |
| 🟡 中等 | 27 | `useTheme` 反模式、钱包事件不监听、Toast 内存泄漏、评论类型不一致等 |

详细清单见 [CHANGELOG.md](./CHANGELOG.md)

### 🧪 测试套件

| 层 | 工具 | 覆盖 | 文件数 |
|---|---|---|---|
| 后端单元 | Vitest + Supertest | 70%+ lines | 11 |
| 前端单元 | Vitest + Testing Library | 60%+ lines | 7 |
| E2E | Playwright(Chrome + Mobile) | 关键路径 | 3 |

```bash
# 跑测试
cd backend && npm test
cd frontend && npm test && npm run test:e2e
```

### 🚀 CI/CD

GitHub Actions 自动跑:
- ✅ ESLint(后端 + 前端)
- ✅ TypeScript 类型检查
- ✅ Vitest + Foundry 测试
- ✅ 前端 build 验证
- ✅ Playwright E2E(需要 DB service)
- ✅ Codecov 覆盖率上传

Dependabot 每周自动 PR 依赖更新。

### 🐳 Docker 一键部署

```bash
docker compose up -d
# 启动:PostgreSQL + Redis + 后端 + 前端
```

包含:
- 多阶段构建(小镜像)
- 非 root 用户运行
- Nginx 反向代理 + gzip
- 健康检查

### 🔒 安全 & 性能

- 速率限制(全局 600/min,写操作 30/min)
- LRU 内存缓存(/api/chains 5min, 排行榜 60s)
- 健康检查端点(`/health`, `/health/ready`, `/metrics`)
- 全局错误处理(不泄漏堆栈)
- CORS 可配置
- Webhook URL / 以太坊地址白名单
- Prometheus 指标(`process_uptime_seconds`, `cache_size`, `nodejs_heap_*`)

详见 [SECURITY.md](./SECURITY.md)

### 📚 文档

- [DEPLOYMENT.md](./DEPLOYMENT.md) - 完整部署指南(Vercel / Railway / Fly.io / Docker)
- [CONTRIBUTING.md](./CONTRIBUTING.md) - 贡献指南
- [SECURITY.md](./SECURITY.md) - 安全策略
- [CHANGELOG.md](./CHANGELOG.md) - 完整变更日志

---

## ⚠️ 重要提醒

1. **测试网优先**:本项目 v1 只上测试网,不上主网(主网上线 = 真实资金风险)
2. **不做任何投资建议**:这只是技术 demo,合约未经第三方审计
3. **参考学习为主**:架构借鉴 pump.fun / four.meme,代码全部原创
