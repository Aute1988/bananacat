/**
 * 缓存中间件
 *
 * 设计:
 *   - 内存 LRU 缓存(单实例)
 *   - 优雅降级:Redis 不可用时不影响功能
 *   - TTL 基于内容变更频率
 *
 * 缓存策略:
 *   - /api/chains       : 5 分钟(链配置基本不变)
 *   - /api/stats/*      : 30 秒(统计变化较慢)
 *   - /api/leaderboard/*: 60 秒(榜单不需要实时)
 *   - /api/tokens/:id   : 10 秒(代币详情可能快速变化)
 *   - 其他              : 默认 5 秒
 */
import { Request, Response, NextFunction } from 'express'
import pino from 'pino'

const log = pino({ transport: { target: 'pino-pretty' } })

interface CacheEntry {
  data: any
  expiresAt: number
}

class MemoryCache {
  private store = new Map<string, CacheEntry>()
  private maxSize = 1000

  get(key: string): any | null {
    const entry = this.store.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return null
    }
    return entry.data
  }

  set(key: string, data: any, ttlMs: number) {
    if (this.store.size >= this.maxSize) {
      // LRU:删除最早插入的(key insertion order)
      const firstKey = this.store.keys().next().value
      if (firstKey) this.store.delete(firstKey)
    }
    this.store.set(key, { data, expiresAt: Date.now() + ttlMs })
  }

  deleteByPrefix(prefix: string) {
    for (const k of this.store.keys()) {
      if (k.startsWith(prefix)) this.store.delete(k)
    }
  }

  clear() {
    this.store.clear()
  }

  stats() {
    return { size: this.store.size, maxSize: this.maxSize }
  }
}

export const cache = new MemoryCache()

/**
 * 缓存中间件工厂
 * @param ttlMs 缓存时间(毫秒)
 * @param keyFn 自定义缓存 key 生成函数
 */
export function cacheMiddleware(
  ttlMs: number,
  keyFn?: (req: Request) => string
) {
  return (req: Request, res: Response, next: NextFunction) => {
    // 只缓存 GET
    if (req.method !== 'GET') return next()

    const key = keyFn
      ? keyFn(req)
      : `__api__${req.originalUrl}`

    const cached = cache.get(key)
    if (cached) {
      res.setHeader('X-Cache', 'HIT')
      res.setHeader('X-Cache-TTL', String(ttlMs))
      return res.json(cached)
    }

    // 拦截 res.json 以缓存
    const originalJson = res.json.bind(res)
    res.json = (body: any) => {
      // 5xx 不缓存
      if (res.statusCode < 500) {
        cache.set(key, body, ttlMs)
      }
      res.setHeader('X-Cache', 'MISS')
      res.setHeader('X-Cache-TTL', String(ttlMs))
      return originalJson(body)
    }

    next()
  }
}

/**
 * 缓存失效工具
 * 当数据变更时清除相关缓存
 */
export function invalidateTokenCache(chainId: number, address: string) {
  cache.deleteByPrefix(`__api__/api/tokens/${chainId}/${address}`)
}

/**
 * 清空所有缓存(管理员用)
 */
export function clearAllCache() {
  cache.clear()
  log.info('缓存已清空')
}
