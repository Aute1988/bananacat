# 🚀 香蕉猫 Launchpad - 部署指南

## 目录

- [架构概览](#架构概览)
- [前置条件](#前置条件)
- [本地开发](#本地开发)
- [测试](#测试)
- [生产部署](#生产部署)
  - [Docker Compose](#docker-compose)
  - [手动部署](#手动部署)
  - [Vercel (前端)](#vercel)
  - [Railway / Fly.io (后端)](#railway)
- [合约部署](#合约部署)
- [监控](#监控)
- [故障排查](#故障排查)

---

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                         Users                               │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┴────────────────┐
        │                                 │
        ▼                                 ▼
   ┌─────────────┐               ┌─────────────────┐
   │   Vercel    │               │   Fly.io /      │
   │  (前端)     │ ◄──────────►  │   Railway       │
   │  Vite + React│              │  (后端)         │
   │  PWA        │               │  Express        │
   └─────────────┘               └────────┬────────┘
                                         │
                  ┌──────────────────────┼───────────────┐
                  │                      │               │
                  ▼                      ▼               ▼
            ┌──────────┐          ┌──────────┐    ┌──────────┐
            │PostgreSQL│          │  Redis   │    │  Pinata  │
            │(数据)    │          │ (缓存)   │    │  (IPFS)  │
            └──────────┘          └──────────┘    └──────────┘
                                         │
                                         ▼
                                   ┌─────────────┐
                                   │ 4 条 EVM 链 │
                                   │ BSC/ETH/    │
                                   │ Robinhood/  │
                                   │ Arc         │
                                   └─────────────┘
```

---

## 前置条件

| 依赖 | 版本 | 用途 |
|---|---|---|
| Node.js | ≥ 20.0 | 前端 + 后端 |
| npm | ≥ 10.0 | 包管理 |
| PostgreSQL | ≥ 16 | 数据库 |
| Foundry | latest | 智能合约 |
| Docker | ≥ 24 | 可选,生产环境推荐 |
| Redis | ≥ 7 | 可选,提升性能 |

---

## 本地开发

### 1. 克隆 & 安装

```bash
git clone https://github.com/your-org/banana-cat.git
cd banana-cat

# 后端
cd backend && npm install && cd ..

# 前端
cd frontend && npm install && cd ..

# 合约(可选)
cd contracts && forge install && cd ..
```

### 2. 启动 PostgreSQL

```bash
# 用 Docker
docker run -d --name bananacat-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=bananacat \
  -p 5432:5432 \
  postgres:16-alpine

# 或系统服务
brew services start postgresql@16
```

### 3. 应用数据库 schema

```bash
cd backend
npm run migrate
```

### 4. 配置 .env

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env.local
# 编辑 backend/.env 填入 RPC / FACTORY 地址
```

### 5. 部署合约(可选)

```bash
cd contracts
forge build
forge script script/Deploy.s.sol --rpc-url $BSC_RPC --broadcast --private-key $PRIVATE_KEY
# 把部署输出的 4 个 FACTORY 地址填到 backend/.env
```

### 6. 启动开发服务器

```bash
# Terminal 1: 后端
cd backend && npm run dev

# Terminal 2: 前端
cd frontend && npm run dev
```

访问 http://localhost:5173

---

## 测试

### 后端

```bash
cd backend

# 单元 + 集成测试
npm test

# 监听模式
npm run test:watch

# 覆盖率
npm run test:coverage

# Lint
npm run lint

# 类型检查
npx tsc --noEmit
```

需要 PostgreSQL 跑测试集成的部分。可用:
```bash
docker run -d --name bananacat-test-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=bananacat_test \
  -p 5432:5432 \
  postgres:16-alpine
DATABASE_URL=postgres://postgres:postgres@localhost:5432/bananacat_test \
  npm test
```

### 前端

```bash
cd frontend

npm test                    # 单测
npm run test:watch          # 监听
npm run test:coverage       # 覆盖率
npm run test:e2e            # Playwright
npm run lint                # ESLint
```

### 合约

```bash
cd contracts
forge test                  # 跑所有测试
forge test --match-test testBuy -vvv  # 单个测试
forge coverage             # 覆盖率
```

---

## 生产部署

### Docker Compose(推荐一站式)

```yaml
# docker-compose.yml
version: '3.9'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: bananacat
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./backend/db/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql
    restart: always

  redis:
    image: redis:7-alpine
    restart: always

  backend:
    build: ./backend
    env_file: ./backend/.env
    environment:
      DATABASE_URL: postgres://postgres:${DB_PASSWORD}@postgres:5432/bananacat
      REDIS_URL: redis://redis:6379
    depends_on: [postgres, redis]
    ports:
      - "3001:3001"
    restart: always

  frontend:
    build:
      context: ./frontend
      args:
        VITE_API_URL: ${PUBLIC_API_URL}
    ports:
      - "80:80"
    depends_on: [backend]
    restart: always

volumes:
  pgdata:
```

启动:
```bash
docker compose up -d
```

### 手动部署

#### 后端 (Node.js + PostgreSQL)

```bash
# 1. 装依赖
cd backend && npm ci --production

# 2. 编译 TypeScript
npm run build

# 3. 应用 schema
psql $DATABASE_URL < db/schema.sql

# 4. 用 PM2 跑
npm i -g pm2
pm2 start dist/index.js --name bananacat-api
pm2 save
pm2 startup
```

#### 前端 (Vercel / Netlify / Nginx)

构建:
```bash
cd frontend
VITE_API_URL=https://api.bananacat.app npm run build
# dist/ 目录即可部署
```

### Vercel (前端)

1. 推送代码到 GitHub
2. 在 Vercel 导入项目
3. 配置:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Env**: `VITE_API_URL=https://你的后端URL`

### Railway / Fly.io (后端)

#### Railway

```bash
# 安装 CLI
npm i -g @railway/cli

# 登录 + 初始化
railway login
railway init

# 添加 PostgreSQL
railway add postgresql

# 部署
railway up

# 设置环境变量
railway variables set BSC_FACTORY=0x...
railway variables set ETH_FACTORY=0x...
# ... 其它 4 条链

# 跑 schema
railway run psql -f db/schema.sql
```

#### Fly.io

```bash
# 安装 CLI
curl -L https://fly.io/install.sh | sh

# 启动
fly launch
fly postgres create
fly postgres attach <db-name>

# 部署
fly deploy

# 配置 env
fly secrets set BSC_FACTORY=0x...
```

---

## 合约部署

### 1. 配置环境变量

```bash
cd contracts
cp .env.example .env

# 填入:
PRIVATE_KEY=0x...                       # 部署者私钥(测试网用)
BSC_RPC=https://rpc.ankr.com/bsc_testnet_chapel
BSC_WETH=0xae13d989daC2f0dEbFf460aC112a837C89BAa7bc   # 测试网 WBNB
```

### 2. 编译 + 测试

```bash
forge build
forge test
```

### 3. 部署到 4 条链

```bash
# BSC Testnet
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url $BSC_RPC --broadcast --private-key $PRIVATE_KEY

# ETH Sepolia(同脚本,换 RPC)
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url $ETH_RPC --broadcast --private-key $PRIVATE_KEY

# Robinhood
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url $ROBINHOOD_RPC --broadcast --private-key $PRIVATE_KEY

# Arc
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url $ARC_RPC --broadcast --private-key $PRIVATE_KEY
```

把 4 个 FACTORY 地址填到 `backend/.env`。

---

## 监控

### 健康检查端点

| 端点 | 用途 |
|---|---|
| `GET /health` | 简单 liveness |
| `GET /health/ready` | Readiness(检查 DB) |
| `GET /metrics` | Prometheus 指标 |

### Prometheus + Grafana

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'bananacat-api'
    scrape_interval: 15s
    static_configs:
      - targets: ['backend:3001']
    metrics_path: /metrics
```

### 推荐指标看板

- `process_uptime_seconds` - 服务可用时间
- `nodejs_heap_used_bytes` - 内存使用
- `cache_size` - 缓存大小
- API 请求 QPS / p95 延迟(用 Nginx 或 API gateway)

### 日志

所有日志走 Pino JSON 格式,推荐用:

- **Loki** + Promtail(Grafana 生态)
- **Datadog**
- **CloudWatch**(AWS)

---

## 故障排查

### 后端起不来

```bash
# 1. 检查 DATABASE_URL
psql $DATABASE_URL -c "SELECT 1"

# 2. 检查 RPC 连通性
curl -X POST $BSC_RPC \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# 3. 检查 factory 地址不是占位
grep FACTORY backend/.env
```

### 索引器不前进

```bash
# 查看 sync_state
psql $DATABASE_URL -c "SELECT * FROM sync_state"

# 重置游标重新同步(慎用!)
psql $DATABASE_URL -c "DELETE FROM sync_state"
```

### 前端白屏

```bash
# 检查 API URL
cat frontend/.env.local

# 检查 Network
浏览器 F12 → Network → /api/health

# 清缓存
localStorage.clear()
```

### 测试失败

```bash
# 后端
cd backend && rm -rf node_modules && npm ci && npm test

# 前端
cd frontend && rm -rf node_modules && npm ci && npm test
```

---

## 安全清单

- [ ] 改所有 .env 默认密码
- [ ] 限制 CORS_ORIGIN 为自己的域名
- [ ] 用 HTTPS(Let's Encrypt)
- [ ] 限制 PostgreSQL 仅本地访问
- [ ] 用 Vault 存私钥(部署者、IPFS)
- [ ] 启用 Fail2Ban 防爆破
- [ ] 配置 rate limit(已默认开启)
- [ ] 定期 `npm audit` 检查漏洞

---

## 性能 checklist

- [ ] PostgreSQL 加 pg_stat_statements 扩展
- [ ] Redis 用于排行榜 / 统计缓存
- [ ] CDN 缓存前端静态资源(Cloudflare / Fastly)
- [ ] 开启 Nginx gzip + Brotli
- [ ] 后端开启 keep-alive
- [ ] 数据库连接池 max=20(已配置)
- [ ] 监控慢查询(> 100ms)
