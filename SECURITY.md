# 🛡️ 安全策略

香蕉猫 Launchpad 非常重视安全。本文档说明如何报告漏洞、我们的安全实践、已知安全考量。

## 目录

- [报告漏洞](#报告漏洞)
- [已实施的安全措施](#已实施的安全措施)
- [已知安全考量](#已知安全考量)
- [智能合约审计](#智能合约审计)
- [最佳实践](#最佳实践)

---

## 报告漏洞

**请勿在公开 GitHub Issue 报告安全漏洞!**

### 联系方式

- **Email**: security@bananacat.app
- **PGP Key**: [下载](https://bananacat.app/.well-known/pgp-key.asc)
- **预期响应时间**:3 个工作日内
- **披露时间**:漏洞修复后 90 天

### 报告应包含

1. 漏洞描述
2. 复现步骤
3. 影响范围
4. 概念证明(PoC)代码或截图
5. 你的名字 / 联系方式(可选,用于致谢)

### 致谢计划

经确认的漏洞报告者将:
- 列入 [Hall of Fame](https://github.com/your-org/banana-cat/security/hall-of-fame)
- 获得 $50-$5000 漏洞赏金(根据严重程度)
- 在 CVE 中公开致谢(经同意)

---

## 已实施的安全措施

### 后端 API

- ✅ **输入校验**:所有用户输入 zod schema 验证
- ✅ **SQL 注入防护**:参数化查询 + 列名白名单
- ✅ **CORS 限制**:生产环境配具体域名(不用 `*`)
- ✅ **速率限制**:
  - 全局:600 次/分钟
  - 写操作:30 次/分钟
  - 评论:5 分钟内 20 条
  - 通知订阅:10 次/分钟
  - IPFS 上传:20 次/分钟
- ✅ **大小限制**:JSON body ≤ 10MB,IPFS ≤ 5MB
- ✅ **以太坊地址校验**:所有地址用正则 `^0x[a-fA-F0-9]{40}$` 验证
- ✅ **Discord/Telegram URL 校验**:白名单前缀/格式
- ✅ **Helmet**(建议部署时开启):安全 headers
- ✅ **优雅错误处理**:不暴露堆栈跟踪
- ✅ **健康检查分离**:`/health` (liveness) vs `/health/ready` (readiness)

### 前端

- ✅ **XSS 防护**:React 默认转义 + i18next 默认 `escapeValue: false` 但用户内容用 `{...}`
- ✅ **CSP**:通过 meta tag 限制 script 来源(见 `index.html`)
- ✅ **localStorage 校验**:语言代码 / 主题用白名单
- ✅ **钱包地址 lowercase**:避免 JOIN 不命中导致数据泄露
- ✅ **PWA scope 限制**:manifest 不暴露敏感路径
- ✅ **依赖审计**:`npm audit` 在 CI 跑

### 数据库

- ✅ **参数化查询**:全部用 `pg` 的 `$1, $2, ...`
- ✅ **复合索引 + 部分索引**:防止全表扫描
- ✅ **外键约束 + ON DELETE CASCADE**:避免孤儿记录
- ✅ **CHECK 约束**:content 长度、vote_type 枚举
- ✅ **ALTER TABLE IF NOT EXISTS**:schema 迁移兼容老库

### 智能合约

- ✅ **OpenZeppelin 库**:使用经过审计的 ERC20 实现
- ✅ **ReentrancyGuard**:所有外部调用函数
- ✅ **SafeERC20**:代币转账用安全包装
- ✅ **Pausable**:紧急情况下可暂停合约
- ✅ **Ownable**:权限管理
- ✅ **CEI 模式**:Checks-Effects-Interactions 严格遵守
- ✅ **完整 NatSpec**:所有 external/public 函数
- ✅ **Forge 覆盖率**:目标 ≥ 90%

---

## 已知安全考量

### ⚠️ 测试网限制

当前**仅部署到测试网**(BSC Testnet / Sepolia / Robinhood Testnet / Arc Testnet)。

- **不要**使用真实资产
- **不要**将测试网私钥用于其他目的
- 主网部署前**必须**经过专业审计公司审计

### ⚠️ 私钥管理

```bash
# .env 文件不能提交
echo ".env" >> .gitignore

# 部署者私钥建议用硬件钱包
# 多签钱包(Gnosis Safe)用于管理员权限

# CI 部署用 GitHub Secrets,绝不入代码
```

### ⚠️ Bonding Curve 风险

联合曲线公式:
```
k = currencyReserve × tokenReserve
```

若 `currencyReserve = 0`(无流动性),任何 buy 会触发除以零(合约用 `mulDiv` 防止,但需人工验证)。

### ⚠️ LP 锁定语义

5 种 lockPeriod:
- 0 = 无锁(可随时取)
- 1-4 = 1 天 / 7 天 / 30 天 / 365 天
- 5 = 永久销毁(LP 转 0xdead,不可逆)

合约代码确保 period = 5 时 `unlockTimestamp = 0` 且 LP 转死亡地址。

### ⚠️ 评论系统

- 评论内容最多 1000 字(防止存储滥用)
- 举报内容最多 500 字
- 单 IP 5 分钟内最多 20 条(防刷)
- 嵌套回复限制 1 层(防止无限递归)
- ⚠️ **当前没有内容审核** — 部署到主网前必须集成 AI 审核或人工审核

### ⚠️ 通知 Webhook

- Discord webhook URL 暴露在数据库 → **必须**配数据库加密(at rest)
- Telegram bot token 暴露 → 用专用的 bot,不与生产 bot 共用
- 订阅接口用白名单 URL 格式

### ⚠️ IPFS 上传

- 5MB 限制防止存储滥用
- ⚠️ **没有 MIME 嗅探防护** — 攻击者可能上传非图片文件 → 建议在后端加 `file-type` 库二次校验
- Pinata / Infura API key 泄露 = 别人用你的额度 → 定期轮换

---

## 智能合约审计

### 测试网审计(已完成)

- ✅ 内部代码审查
- ✅ Forge 模糊测试(`forge test --fuzz`)
- ✅ 静态分析(`slither`)
- ✅ Gas 优化(`forge test --gas-report`)

### 主网前审计 checklist

- [ ] 外部审计公司审计(CertiK / Trail of Bits / OpenZeppelin)
- [ ] Bug Bounty 程序(Immunefi)
- [ ] 多签管理员 + Timelock
- [ ] 紧急暂停机制测试
- [ ] 升级路径文档化(如果使用 Proxy)
- [ ] 事故响应 Runbook

---

## 最佳实践

### 部署前

```bash
# 1. 依赖审计
cd backend && npm audit
cd frontend && npm audit
forge install --no-commit  # 检查新依赖

# 2. 静态分析
slither contracts/src/

# 3. 跑所有测试 + 覆盖率
npm test -- --coverage
forge coverage

# 4. E2E 测试
npx playwright test
```

### 运行时监控

```bash
# Prometheus + Grafana 看板
# - 4xx/5xx 错误率(> 5% 告警)
# - DB 连接池使用率(> 80% 告警)
# - API p95 延迟(> 500ms 告警)
# - RPC 调用失败率(> 1% 告警)
# - 索引器 last_block 落后当前高度(> 10 blocks 告警)
```

### 密钥轮换

- **私钥**:每 90 天轮换
- **JWT secret**(如果有):每 30 天
- **API key**(Pinata/Infura):每 180 天
- **DB 密码**:每 90 天

### 备份策略

- PostgreSQL 每日全量备份 + 每小时增量备份
- 备份保留 30 天
- 异地存储(S3 / GCS)
- **每月**演练恢复流程

### 事故响应

| 级别 | 描述 | 响应时间 |
|---|---|---|
| P0 | 合约漏洞 / 用户资产风险 | 立即(< 1 小时) |
| P1 | API 全挂 | < 4 小时 |
| P2 | 部分功能降级 | < 24 小时 |
| P3 | 性能问题 | < 1 周 |

事故响应 Runbook 写在 [RUNBOOK.md](./RUNBOOK.md)(待补充)。

---

## 致谢

感谢以下安全研究者的贡献:
(待补充)

---

**最后更新**: 2026-09-17
