# 🏗️ 架构文档

## 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                       前端 (React + Vite)                     │
│  - 发币页 / 代币列表 / 代币详情 / 我的代币 / LP 解锁面板       │
│  - 香蕉猫主题 UI (Tailwind)                                  │
│  - 钱包连接 (MetaMask)                                       │
└─────────────────────────────────────────────────────────────┘
                              ↓ REST API
┌─────────────────────────────────────────────────────────────┐
│                       后端 (Node.js + Express)                │
│  - PostgreSQL 存储代币 / 交易 / 锁仓记录                      │
│  - Viem 监听 4 条链的链上事件                                  │
│  - REST API 给前端提供数据                                    │
└─────────────────────────────────────────────────────────────┘
                              ↓ 监听事件
┌─────────────────────────────────────────────────────────────┐
│                      智能合约 (Solidity)                       │
│                                                              │
│  ┌────────────┐     ┌────────────┐     ┌────────────┐         │
│  │  BananaCat  │ ─→  │  Bonding    │ ─→  │   LP        │       │
│  │  Factory    │     │  Curve      │     │   Locker    │       │
│  └────────────┘     └────────────┘     └────────────┘         │
│         ↑                   │                   ↑             │
│         │                   ↓                   │             │
│         │            ┌────────────┐            │             │
│         └────────────│  Migrator  │────────────┘             │
│                      │ (链特定)   │                          │
│                      └────────────┘                          │
│                             ↓                                │
│                      PancakeSwap / Uniswap / 自建池            │
└─────────────────────────────────────────────────────────────┘
```

## 核心数据流

### 1. 发币流程

```
用户 (前端)
  │ 填写代币信息 + 锁仓期限
  │ 支付 0.005 BNB/ETH/USDC
  ↓
BananaCatFactory.createToken()
  │ 克隆部署 BananaCatToken (EIP-1167)
  │ 克隆部署 BondingCurve (EIP-1167)
  │ 初始化代币 + 曲线
  ↓
返回 (token address, curve address)
  ↓
前端展示新代币 + 进入代币列表
```

### 2. 买卖流程

```
交易者 (前端)
  │ 输入买入数量
  ↓
BondingCurve.buy{value: 0.5 ether}()
  │ 计算手续费 (1%)
  │ 按 constant product 公式计算输出
  │ currencyReserve += 0.5 ether (扣手续费)
  │ tokensSold += N
  │ 代币从曲线转到买家
  │ 手续费转到工厂
  ↓
触发 Buy 事件
  ↓
后端索引器监听 → 存入数据库 → 前端实时刷新
```

### 3. 毕业流程

```
最后一个买家买入 → currencyReserve 达到 24 ether
  ↓
BondingCurve 自动检测到
  ↓
设置 graduated = true
  ↓
调用 BananaCatFactory.onGraduated()
  ↓
调用 Migrator.graduate(token, curve, creator, lockPeriod, nativeAmount)
  │ 添加流动性到 PancakeSwap (BSC) / Uniswap (ETH)
  │ 获得 LP 代币
  ↓
调用 LPLocker.lockLP(token, creator, lpAmount, lockPeriod)
  │ 记录锁仓信息
  │ 如果是 PERMANENT_BURN → 立即 burnLP()
  ↓
触发 LPLocked / LPBurned 事件
  ↓
后端索引器更新数据库
  ↓
前端「我的代币」显示已毕业
```

### 4. LP 领取流程

```
发币者进入 /my-tokens 页面
  ↓
后端查询此地址的所有 lp_locks 记录
  ↓
显示状态:
  - 锁仓中:倒计时 + Lock ID
  - 可领取:绿色按钮
  - 已销毁:红色提示
  ↓
点击「领取 LP」
  ↓
LPLocker.claimLP(lockId)
  │ 验证是创建者
  │ 验证已到 unlock 时间
  │ 验证未领取
  │ 转 LP 代币到创建者
  │ 标记 claimed = true
  ↓
前端显示成功 + 交易哈希
```

## 智能合约核心组件

### BananaCatFactory

- 作用:统一入口,创建代币
- 模式:工厂模式 + EIP-1167 克隆
- 关键功能:
  - `createToken()`:创建代币 + 曲线
  - `onGraduated()`:接收曲线毕业回调,触发迁移

### BananaCatToken

- 作用:极简 ERC-20 实现
- 特点:
  - 固定 10 亿供应,无 mint 函数
  - 18 decimals
  - 无 owner / blacklist / pausable(纯 Meme)
  - 克隆模式部署,每个代币仅 ~100k gas

### BondingCurve

- 作用:链上交易池
- 算法:Constant Product (x * y = k) 类似 Uniswap V2
- 关键特性:
  - 虚拟储备(让初始价格合理)
  - 1% 手续费(归平台)
  - 滑点保护(minTokenOut / minCurrencyOut)
  - 达到 24 ether 自动触发毕业

### LPLocker 🆕

- 作用:**核心差异化功能**
- 支持 6 种锁仓模式:
  - NONE (无锁仓)
  - ONE_DAY (1 天)
  - SEVEN_DAYS (7 天)
  - THIRTY_DAYS (30 天)
  - ONE_YEAR (365 天)
  - PERMANENT_BURN (永久销毁 🔥)
- 安全特性:
  - 只有工厂/Migrator 能创建锁仓
  - 只有创建者本人能领取
  - 永久销毁 → LP 永远拿不出来
  - 锁仓期任何人都无法操作

### Migrator (链特定)

- 作用:把曲线资产迁移到 DEX
- 4 个实现:
  - `MigratorBSC`:PancakeSwap V2
  - `MigratorETH`:Uniswap V3 (待实现)
  - `MigratorRobinhood`:Robinhood Chain AMM (待实现)
  - `MigratorArc`:Arc USDC AMM (待实现)

## 安全设计

| 攻击向量 | 防护措施 |
|---|---|
| **重入攻击** | 状态变量在转账前更新 |
| **滑点攻击** | 用户必须设置 minOutput |
| **整数溢出** | Solidity 0.8+ 内置检查 |
| **抢跑攻击** | LPLocker 只信任工厂调用 |
| **跑路风险** | 🆕 LP 锁仓自选 + 永久销毁选项 |
| **Dust 攻击** | 创建费用 0.005 ETH |
| **虚假毕业** | 工厂验证 msg.sender == curve |

## 数据库设计

4 张核心表:
- `tokens`:所有代币信息
- `bonding_curves`:曲线状态
- `trades`:每笔交易
- `lp_locks`:每笔锁仓记录

加 1 张统计表:
- `platform_stats`:每小时聚合数据

详见 `backend/db/schema.sql`

## API 设计

主要端点:
- `GET /api/tokens` - 代币列表
- `GET /api/tokens/:chainId/:address` - 代币详情
- `GET /api/creator/:address/tokens` - 某地址创建的代币
- `GET /api/creator/:address/locks` - 某地址的锁仓
- `GET /api/stats` - 平台统计

详见 `backend/src/api.ts`

## 4 条链的差异化

| 链 | 原生币 | DEX | 部署工具 |
|---|---|---|---|
| BSC | BNB | PancakeSwap V2 | Foundry |
| Ethereum | ETH | Uniswap V3 | Foundry |
| Robinhood | ETH | 自建 AMM | Foundry |
| Arc | USDC | 待定 | Foundry |

> 同一个 Solidity 合约代码,通过不同的 Migrator 子类适配各链 DEX。
