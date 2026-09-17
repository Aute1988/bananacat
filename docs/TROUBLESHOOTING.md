# 🐛 故障排查指南

## 常见问题速查

### 编译/部署

| 问题 | 解决 |
|---|---|
| `forge: command not found` | 运行 `foundryup` |
| 编译错误: `Identifier already declared` | 检查 Solidity 版本,推荐 `^0.8.24` |
| 部署失败: `insufficient funds` | 给钱包充值测试网币 |
| `gas estimation failed` | 检查合约地址是否正确 |
| 部署超时 | 换 RPC,推荐 Alchemy/Infura |

### 前端

| 问题 | 解决 |
|---|---|
| 页面空白 | 检查 `vite` 是否启动,看 console 错误 |
| 钱包连不上 | 检查 MetaMask 是否安装并解锁 |
| 切链失败 | 手动添加自定义 RPC,见 `frontend/src/chains/config.ts` |
| 交易失败 | 检查测试网币余额、滑点设置 |
| ABI 错误 | 重新编译合约,更新 `src/abis/` |

### 后端

| 问题 | 解决 |
|---|---|
| 数据库连接失败 | 检查 PostgreSQL 是否启动,`.env` 配置 |
| 索引器同步慢 | 换更快的 RPC 节点 |
| 事件丢失 | 启动时设置 `SYNC_FROM_BLOCK` |
| API 502 | 检查后端进程是否运行 |

---

## 调试技巧

### 合约调试

```bash
# 单步调试
forge test --match-test test_Graduation -vvvv

# 打印 trace
forge script script/DeployBSC.s.sol --rpc-url bsc_testnet -vvvv
```

### 前端调试

```bash
# 打开浏览器 console,看 RPC 调用
# 在 vite.config.ts 中加:
server: { port: 5173, host: '0.0.0.0' }
```

### 后端调试

```bash
# 后端用 pino-pretty 输出格式化日志
# 改 backend/src/index.ts:
log.level = 'debug'
```

---

## 性能优化

### 合约 gas 优化

```bash
# 用 --via-ir 优化
forge build --via-ir

# 用 optimizer
# foundry.toml 已设置 optimizer_runs = 200
```

### 前端优化

```bash
# 生产构建
npm run build

# 分析 bundle
npm install -g webpack-bundle-analyzer
# 然后 vite build --mode analyze
```

### 后端优化

- 数据库加索引(已加)
- 缓存热门数据(Redis,后续优化)
- 批量插入 trades

---

## 应急操作

### 暂停合约(紧急)

```solidity
// 在 Migrator 加:
bool public paused;

function pause() external onlyOwner {
    paused = true;
}
```

> ⚠️ 本项目 v1 没加 pause 机制,因为是测试网。如果主网上线必须加。

### 数据迁移

```bash
# 导出数据
pg_dump bananacat > backup.sql

# 导入数据
psql -U postgres -d bananacat < backup.sql
```

---

## 升级路径

### 合约升级

本项目使用**不可升级合约**(更安全)。如需升级:
- 部署新版本合约
- 通过工厂迁移用户数据
- 切换前端/后端指向新合约

### 后端升级

直接替换代码 + 重启进程:
```bash
pm2 restart backend
```

### 前端升级

```bash
npm run build
# 部署 dist/ 到 CDN
```
