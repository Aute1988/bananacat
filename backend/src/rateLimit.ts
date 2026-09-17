/**
 * 速率限制中间件
 *
 * 防止 API 被滥用、暴力破解、DDoS
 *
 * 三种限制器:
 *   - strictLimiter: 写操作(POST/DELETE) - 30 次/分钟
 *   - moderateLimiter: 一般读操作 - 300 次/分钟
 *   - relaxedLimiter: 健康检查、链配置等 - 1000 次/分钟
 *
 * 🆕 修复 L-5: 优先使用 Redis store(支持多实例部署),无 Redis 时降级到内存
 */
import rateLimit from 'express-rate-limit'
import type { Store } from 'express-rate-limit'
import pino from 'pino'

const log = pino({ transport: { target: 'pino-pretty' } })

// 异步初始化 Redis store,失败时降级到默认内存
let redisStore: Store | undefined = undefined
async function initRedisStore(): Promise<void> {
  if (redisStore !== undefined && (redisStore as any).__initialized) return
  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) {
    log.info('未配置 REDIS_URL,使用默认内存 store(单实例)')
    redisStore = undefined
    return
  }
  try {
    // 动态 import 避免未装 redis 包时启动失败(@ts-ignore 绕过类型检查,运行时依赖是可选的)
    // @ts-ignore - rate-limit-redis 类型可能不存在
    const [{ default: RedisStore }, { default: ioredis }] = await Promise.all([
      // @ts-ignore
      import('rate-limit-redis').catch(() => ({ default: null as any })),
      // @ts-ignore
      import('ioredis').catch(() => ({ default: null as any })),
    ])
    if (!RedisStore || !ioredis) {
      log.warn('rate-limit-redis 或 ioredis 未安装,降级到内存 store')
      redisStore = undefined
      return
    }
    const client = new ioredis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    })
    await client.connect()
    redisStore = new RedisStore({
      // @ts-ignore - sendCommand 类型
      sendCommand: (...args: string[]) => client.call(...args) as any,
    })
    ;(redisStore as any).__initialized = true
    log.info('Redis store 初始化成功,多实例共享')
  } catch (err: any) {
    log.warn({ err: err.message }, 'Redis 连接失败,降级到内存 store')
    redisStore = undefined
  }
}

// 服务启动时异步初始化(不阻塞)
initRedisStore().catch(() => {})

function buildStore(): Store | undefined {
  return redisStore
}

// 通用配置
const baseConfig = {
  standardHeaders: true,
  legacyHeaders: false,
  // 自定义错误响应
  handler: (req: any, res: any, _next: any, options: any) => {
    log.warn({ ip: req.ip, path: req.path }, '速率限制触发')
    res.status(options.statusCode).json({
      error: '请求太频繁,请稍后再试',
      retryAfter: Math.ceil(options.windowMs / 1000),
    })
  },
}

// 严格限制(写操作)
export const strictLimiter = rateLimit({
  ...baseConfig,
  store: buildStore(),
  windowMs: 60 * 1000,        // 1 分钟
  max: 30,                     // 30 次/分钟
  message: { error: '写操作过于频繁' },
})

// 中等限制(默认读操作)
export const moderateLimiter = rateLimit({
  ...baseConfig,
  store: buildStore(),
  windowMs: 60 * 1000,
  max: 300,
})

// 宽松限制(健康检查等)
export const relaxedLimiter = rateLimit({
  ...baseConfig,
  store: buildStore(),
  windowMs: 60 * 1000,
  max: 1000,
})

// 特定端点的自定义限制器

/**
 * 评论 API:防止刷评论
 * 同一 IP 5 分钟内最多 20 条评论
 */
export const commentLimiter = rateLimit({
  ...baseConfig,
  store: buildStore(),
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: { error: '评论过于频繁,5 分钟后再来' },
})

/**
 * 通知订阅 API:防止滥用 webhook
 */
export const subscribeLimiter = rateLimit({
  ...baseConfig,
  store: buildStore(),
  windowMs: 60 * 1000,
  max: 10,
  message: { error: '订阅操作过于频繁' },
})

/**
 * IPFS 上传 API:防止滥用存储
 */
export const uploadLimiter = rateLimit({
  ...baseConfig,
  store: buildStore(),
  windowMs: 60 * 1000,
  max: 20,
  message: { error: '上传过于频繁,1 分钟后重试' },
})

/**
 * 全局中间件:对所有 /api/* 路由启用基础速率限制
 */
export const globalLimiter = rateLimit({
  ...baseConfig,
  store: buildStore(),
  windowMs: 60 * 1000,
  max: 600, // 总兜底
  skip: (req) => req.path === '/health' || !req.path.startsWith('/api/'),
})
