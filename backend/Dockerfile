# ============================================================
# 多阶段构建
# ============================================================

# 阶段 1:构建
FROM node:20-alpine AS builder
WORKDIR /app

# 安装构建依赖(pg 模块需要)
RUN apk add --no-cache python3 make g++ libc6-compat

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY db ./db

# 编译
RUN npm run build

# 移除 dev 依赖
RUN npm prune --production

# 阶段 2:运行时
FROM node:20-alpine
WORKDIR /app

# 安全:用非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 仅复制运行时需要的东西
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/db ./db
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json

USER nodejs

ENV NODE_ENV=production \
    PORT=3001

EXPOSE 3001

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost:3001/health || exit 1

CMD ["node", "dist/index.js"]
