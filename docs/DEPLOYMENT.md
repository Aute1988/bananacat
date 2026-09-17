# 🚀 部署文档

本指南教你如何把香蕉猫 Launchpad 部署到 4 条链的测试网。

---

## 📋 部署前准备

### 1. 安装依赖

```bash
# 1) 安装 Foundry(智能合约工具)
curl -L https://foundry.paradigm.xyz | bash
foundryup

# 2) 安装 Node.js 18+(前端/后端)
# Mac: brew install node@18
# Linux: nvm install 18

# 3) 安装 PostgreSQL(后端数据库)
# Mac: brew install postgresql
# Linux: sudo apt install postgresql
```

### 2. 准备钱包

- 安装 **MetaMask**(浏览器插件)
- 创建测试钱包,**保存好私钥**(部署时用)
- 给钱包充值测试网币(下面有链接)

### 3. 获取测试网币

| 链 | 水龙头 |
|---|---|
| BSC Testnet | https://testnet.bnbchain.org/faucet-smart |
| Sepolia | https://sepoliafaucet.com |
| Robinhood Testnet | https://faucet.chain.robinhood.com |
| Circle Arc Testnet | https://faucet.circle.com |

---

## 🔧 部署合约(4 条链)

### 配置环境变量

```bash
# 通用
export PRIVATE_KEY=0x...                  # 你的测试钱包私钥(去掉 0x 前缀)

# BSC
export BSC_TESTNET_RPC=https://rpc.ankr.com/bsc_testnet_chapel

# Ethereum (Sepolia)
export SEPOLIA_RPC=https://rpc.sepolia.org

# Robinhood
export ROBINHOOD_TESTNET_RPC=https://rpc.testnet.chain.robinhood.com

# Circle Arc
export ARC_TESTNET_RPC=https://rpc.testnet.arc.io
```

### 部署到 BSC

```bash
cd contracts
forge script ../scripts/DeployBSC.s.sol:DeployBSC \
  --rpc-url bsc_testnet \
  --broadcast \
  -vvvv
```

✅ 成功后会打印 4 个合约地址,记录下来!

### 部署到 Ethereum (Sepolia)

```bash
forge script ../scripts/DeployETH.s.sol:DeployETH \
  --rpc-url sepolia \
  --broadcast \
  -vvvv
```

### 部署到 Robinhood Chain

```bash
forge script ../scripts/DeployRobinhood.s.sol:DeployRobinhood \
  --rpc-url robinhood_testnet \
  --broadcast \
  -vvvv
```

### 部署到 Circle Arc

```bash
forge script ../scripts/DeployArc.s.sol:DeployArc \
  --rpc-url arc_testnet \
  --broadcast \
  -vvvv
```

> ⚠️ 注意:Robinhood 和 Arc 上的 AMM 路由地址需要你在部署前填入(目前是占位符)。查官方文档获取正确地址。

---

## 🧪 运行测试

```bash
cd contracts

# 跑全部测试
forge test

# 详细输出
forge test -vvv

# 含 gas 报告
forge test --gas-report

# 单个合约测试
forge test --match-contract LPLockerTest
```

---

## 🖥️ 启动前端

### 1. 安装依赖

```bash
cd frontend
npm install  # 或 pnpm install
```

### 2. 配置合约地址

编辑 `src/chains/config.ts`,把部署后的合约地址填入:

```typescript
export const CHAINS = {
  bsc: {
    ...
    factoryAddress: '0xYOUR_BSC_FACTORY_ADDRESS',  // ← 部署后填入
    lpLockerAddress: '0xYOUR_BSC_LOCKER_ADDRESS',
    migratorAddress: '0xYOUR_BSC_MIGRATOR_ADDRESS',
  },
  ...
}
```

### 3. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:5173

### 4. 构建生产版本

```bash
npm run build
npm run preview
```

---

## 🔌 启动后端

### 1. 安装依赖

```bash
cd backend
npm install  # 或 pnpm install
```

### 2. 创建数据库

```bash
# 启动 PostgreSQL
brew services start postgresql  # Mac
# 或: sudo service postgresql start  # Linux

# 创建数据库
createdb bananacat

# 跑 schema
psql -U postgres -d bananacat < db/schema.sql
```

### 3. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env,填入:
# - DATABASE_URL
# - 各链 RPC
# - 各链工厂合约地址
```

### 4. 启动开发服务器

```bash
npm run dev
```

API 访问 http://localhost:3001

### 5. 测试 API

```bash
# 健康检查
curl http://localhost:3001/health

# 获取代币列表
curl http://localhost:3001/api/tokens?limit=10

# 获取某地址创建的代币
curl http://localhost:3001/api/creator/0xYOUR_ADDRESS/tokens

# 获取某代币详情
curl http://localhost:3001/api/tokens/97/0xTOKEN_ADDRESS
```

---

## 📦 一键启动脚本

```bash
# 根目录
./scripts/start-all.sh   # 同时启动前端+后端(需要你编写)
```

---

## 🔍 验证部署

### 1. 在区块浏览器查看合约

- BSC: https://testnet.bscscan.com/address/0xFACTORY
- Sepolia: https://sepolia.etherscan.io/address/0xFACTORY
- Robinhood: https://explorer.testnet.chain.robinhood.com/address/0xFACTORY
- Arc: https://testnet.arcscan.app/address/0xFACTORY

### 2. 手动测试

1. 连接 MetaMask(切换到对应测试网)
2. 在前端点击「发币」
3. 填写信息 + 选择锁仓期限
4. 支付 0.005 BNB/ETH
5. 等待交易确认
6. 在「我的代币」查看

### 3. 跑端到端测试

```bash
cd contracts
forge test --match-path test/IntegrationTest.t.sol -vvv
```

---

## 🌐 上线主网(可选,慎选)

⚠️ 主网上线前必须做:
- [ ] 第三方安全审计(预计花费 5-20 万人民币)
- [ ] Bug 赏金计划
- [ ] 完整测试覆盖率 > 90%
- [ ] 法律合规审查

---

## ❓ 常见问题

**Q: 部署失败了?**
A: 检查:
- 钱包是否在该测试网有钱?
- RPC URL 是否正确?
- 私钥格式是否正确?

**Q: 前端连接后,余额显示 0?**
A: 检查:
- MetaMask 是否切换到正确的链?
- 合约地址是否填入?
- 测试币是否够?

**Q: 交易一直 pending?**
A: 测试网偶尔会卡,等 30 秒或者刷新页面再试。

**Q: 怎么切换链?**
A: 点击右上角链选择器,选 BSC/Ethereum/Robinhood/Arc。

---

## 📞 获取帮助

- GitHub Issues: https://github.com/your-repo/issues
- Discord: [待定]
- Telegram: [待定]

---

⚠️ **免责声明**:本项目仅供学习测试,请勿投入真实资产。
