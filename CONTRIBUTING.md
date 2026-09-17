# 🤝 贡献指南

感谢你考虑为香蕉猫 Launchpad 做出贡献!下面是开发流程。

## 目录

- [Code of Conduct](#code-of-conduct)
- [开发流程](#开发流程)
- [Pull Request 流程](#pull-request-流程)
- [代码规范](#代码规范)
- [目录结构](#目录结构)
- [测试要求](#测试要求)
- [报告 Bug](#报告-bug)
- [提议新功能](#提议新功能)

---

## Code of Conduct

本项目遵循 [Contributor Covenant](https://www.contributor-covenant.org/) 行为准则。所有贡献者应:

- 友善包容
- 尊重不同观点
- 接受建设性批评
- 关注对社区最有利的事

---

## 开发流程

### 1. Fork & Clone

```bash
git clone https://github.com/your-username/banana-cat.git
cd banana-cat
git remote add upstream https://github.com/original-org/banana-cat.git
```

### 2. 创建分支

```bash
git checkout -b feature/your-feature-name
# 或
git checkout -b fix/issue-123
```

### 3. 安装依赖

```bash
# 后端
cd backend && npm install && cd ..

# 前端
cd frontend && npm install && cd ..

# 合约
cd contracts && forge install && cd ..
```

### 4. 跑测试(开发前先确认基线)

```bash
# 后端
cd backend && npm test && cd ..

# 前端
cd frontend && npm test && cd ..

# 合约
cd contracts && forge test && cd ..
```

### 5. 开发 + 增量测试

```bash
# 监听模式
cd backend && npm run test:watch
cd frontend && npm run test:watch

# 在另一个终端开发
```

### 6. 提交前自检

```bash
# 后端
cd backend
npm run lint
npm test
npx tsc --noEmit

# 前端
cd frontend
npm run lint
npm test
npx tsc --noEmit

# 合约
cd contracts
forge build
forge test
```

---

## Pull Request 流程

### 1. 推送分支

```bash
git push origin feature/your-feature-name
```

### 2. 在 GitHub 创建 PR

- 标题:简洁描述改动(如 `feat: 添加代币锁定扩展功能`)
- 描述:填写 PR 模板
- 关联 Issue(如 `Closes #123`)

### 3. CI 必须通过

以下检查都需通过:
- ✅ ESLint
- ✅ TypeScript 编译
- ✅ Vitest(后端 + 前端)
- ✅ Foundry test(合约)
- ✅ Playwright E2E

### 4. Code Review

- 至少 1 个维护者 approve
- 解决所有 review comments
- Squash commits(可选)

### 5. 合并

maintainer 会用 squash merge。

---

## 代码规范

### TypeScript / JavaScript

- **缩进**:2 空格
- **引号**:单引号 `'...'`
- **分号**:必须有
- **尾逗号**:必须有(ESLint 自动格式化)
- **命名**:
  - 变量/函数:`camelCase`
  - 类/类型:`PascalCase`
  - 常量:`UPPER_SNAKE_CASE`
  - 私有:`_` 前缀
- **TypeScript**:
  - 优先用 `interface` 而非 `type`(除非必要)
  - 避免 `any`,必要时加注释解释
  - 函数返回类型必须显式声明(导出函数)

### Solidity

- 缩进:2 空格
- 函数顺序:
  1. constructor
  2. receive / fallback
  3. external
  4. public
  5. internal
  6. private
- 每个 external/public 函数必须有 NatSpec 注释:
  ```solidity
  /// @title 函数简述
  /// @notice 用户视角说明
  /// @dev 实现细节(可选)
  /// @param x 参数说明
  /// @return 返回值说明
  ```
- 状态变量加注释

### 提交规范(Conventional Commits)

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`:新功能
- `fix`:Bug 修复
- `refactor`:重构(无新功能、无 Bug 修复)
- `docs`:仅文档
- `test`:仅测试
- `chore`:杂项(依赖、CI 等)
- `perf`:性能优化
- `style`:格式(不影响代码逻辑)

**Scopes:**
- `backend` / `frontend` / `contracts` / `db` / `ci` / `docs`

**示例:**
```
feat(backend): 添加大额交易通知触发器
fix(frontend): 修复评论组件 total 类型不一致
docs: 部署文档补充 Redis 配置
test(comments): 增加投票差量测试覆盖
```

---

## 目录结构

```
banana-cat/
├── backend/                # Express API + 索引器
│   ├── src/
│   │   ├── api.ts          # 路由
│   │   ├── indexer.ts      # 链事件索引
│   │   ├── db.ts           # 数据库连接
│   │   ├── ...
│   │   └── health.ts       # 健康检查
│   ├── tests/              # Vitest 测试
│   ├── db/schema.sql       # 数据库 schema
│   └── Dockerfile
├── frontend/               # Vite + React
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── i18n.ts
│   │   └── ...
│   ├── tests/              # Vitest + Playwright
│   └── Dockerfile
├── contracts/              # Foundry 智能合约
│   ├── src/
│   ├── test/
│   └── script/
├── .github/
│   ├── workflows/          # CI/CD
│   ├── dependabot.yml
│   └── pull_request_template.md
├── docker-compose.yml
├── DEPLOYMENT.md
├── CONTRIBUTING.md         # 本文件
├── SECURITY.md
├── CHANGELOG.md
└── README.md
```

---

## 测试要求

### 覆盖率门槛

| 范围 | 门槛 |
|---|---|
| 后端 lines | ≥ 70% |
| 后端 functions | ≥ 70% |
| 后端 branches | ≥ 60% |
| 前端 lines | ≥ 60% |

新增功能必须包含测试。Bug 修复必须包含回归测试。

### 测试文件命名

- 后端:`*.test.ts`(与源文件同级 或 在 `tests/`)
- 前端:`*.test.tsx`(组件) / `*.test.ts`(hooks/utils)
- E2E:`tests/e2e/*.spec.ts`
- 合约:`test/*.t.sol`

### Mock 约定

- 后端测试:`vi.mock('./db.js', () => ({...}))`
- 前端测试:`vi.mock('../hooks/xxx', () => ({...}))`
- 不要 mock 太多 — 集成价值高于单元测试

---

## 报告 Bug

提交 GitHub Issue,标签 `bug`,包含:

1. **复现步骤**
2. **期望行为**
3. **实际行为**
4. **截图**(UI 问题)
5. **环境**:
   - OS
   - Node 版本
   - 浏览器版本
   - 后端/前端 commit hash

---

## 提议新功能

提交 GitHub Issue,标签 `enhancement`,包含:

1. **动机**:解决什么问题?
2. **方案**:你建议怎么做?
3. **替代方案**:考虑过哪些其它方法?
4. **截图 / Mockup**(UI 改动)

---

## 第一次贡献?

可以从这些 good first issue 开始:
- `good first issue` 标签的 Issue
- 文档错别字修正
- 测试覆盖率提升
- 小 bug 修复

---

有任何问题?在 [GitHub Discussions](https://github.com/your-org/banana-cat/discussions) 提问。
