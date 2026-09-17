/**
 * rate limit + cache + health 中间件集成测试
 *
 * ⚠️ 沙箱禁止所有 socket,完全不走网络
 * 测试中间件逻辑,不启动 server
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/db.js', () => ({
  query: async () => [],
  queryRaw: async () => ({ rows: [], rowCount: 0 }),
  pool: { connect: async () => ({ query: async () => ({ rows: [] }), release: () => {} }) },
}))
vi.mock('../src/priceCandleService.js', () => ({
  getCandles: async () => [],
  get24hChange: async () => null,
  INTERVALS: ['1m', '5m', '15m', '1h', '4h', '1d'],
}))
vi.mock('../src/leaderboardService.js', () => ({
  getLeaderboard: async () => [{ rank: 1, address: '0xtoken', chain_id: 97 }],
  getLeaderboardSummary: async () => ({ hot: [], gainers: [], new: [], graduating: [] }),
  getMiniSparkline: async () => [],
}))
vi.mock('../src/comments.js', () => ({
  createComment: vi.fn(async () => ({ id: 1 })),
  getCommentsByToken: vi.fn(async () => []),
  getCommentCount: vi.fn(async () => 0),
  voteComment: vi.fn(async () => {}),
  deleteComment: vi.fn(async () => true),
  reportComment: vi.fn(async () => {}),
}))

describe('rate limit 模块', () => {
  it('导出所有限速器', async () => {
    const mod = await import('../src/rateLimit.js')
    expect(mod.strictLimiter).toBeDefined()
    expect(mod.moderateLimiter).toBeDefined()
    expect(mod.relaxedLimiter).toBeDefined()
    expect(mod.commentLimiter).toBeDefined()
    expect(mod.subscribeLimiter).toBeDefined()
    expect(mod.uploadLimiter).toBeDefined()
    expect(mod.globalLimiter).toBeDefined()
  })

  it('strictLimiter 在 30 次后拒绝', async () => {
    const { strictLimiter } = await import('../src/rateLimit.js')

    let triggered = false
    let finalStatus = 0
    let finalBody: any = null

    for (let i = 0; i < 35; i++) {
      const req = { ip: '192.168.99.99', path: '/test' } as any
      const res = {
        statusCode: 200,
        headers: {} as Record<string, string>,
        setHeader(k: string, v: string) { this.headers[k.toLowerCase()] = v; return this },
        status(code: number) { this.statusCode = code; return this },
        json(b: any) { finalBody = b; return this },
      } as any

      let passedThrough = false
      await new Promise<void>((resolve) => {
        strictLimiter(req, res, () => {
          passedThrough = true
          resolve()
        })
        // handler 调 res.json 后,不会 next
        setImmediate(() => resolve())
      })

      if (!passedThrough && res.statusCode === 429) {
        triggered = true
        finalStatus = 429
        break
      }
    }
    expect(triggered).toBe(true)
    expect(finalStatus).toBe(429)
    expect(finalBody).toBeDefined()
    expect(finalBody.error).toBeDefined()
  }, 30000)
})

describe('cache middleware', () => {
  it('导出 cache 和 cacheMiddleware', async () => {
    const { cache, cacheMiddleware, invalidateTokenCache, clearAllCache } = await import('../src/cache.js')
    expect(cache).toBeDefined()
    expect(cacheMiddleware).toBeDefined()
    expect(invalidateTokenCache).toBeDefined()
    expect(clearAllCache).toBeDefined()
  })

  it('cache 基本的 set/get/clear 行为', async () => {
    const { cache } = await import('../src/cache.js')
    cache.clear()
    cache.set('test-key', { foo: 'bar' }, 1000)
    expect(cache.get('test-key')).toEqual({ foo: 'bar' })
    expect(cache.stats().size).toBeGreaterThan(0)
    cache.clear()
    expect(cache.get('test-key')).toBeNull()
  })

  it('cacheMiddleware 在第二次相同请求时返回 HIT', async () => {
    const { cacheMiddleware, cache } = await import('../src/cache.js')
    cache.clear()

    // 直接调 cacheMiddleware(fn)
    let handlerCalls = 0
    const realHandler = (_req: any, res: any) => {
      handlerCalls++
      res.json({ data: 'fresh' })
    }

    // cacheMiddleware 接收 ttlMs,返回中间件
    const mw = cacheMiddleware(5000)

    function makeRes() {
      const r: any = {
        statusCode: 200,
        headers: {} as Record<string, string>,
        body: undefined,
        setHeader(k: string, v: string) { this.headers[k.toLowerCase()] = v; return this },
        status(c: number) { this.statusCode = c; return this },
        json: function (this: any, d: any) { this.body = d; return this },
        send(d: any) { this.body = d; return this },
        end() { this.ended = true; return this },
      }
      return r
    }

    function makeReq() {
      return { method: 'GET', url: '/test', originalUrl: '/test', path: '/test', headers: {}, ip: '127.0.0.1' } as any
    }

    // 第一次:cache MISS,handler 应被调
    let next1Called = false
    let cacheSizeBefore: any
    await new Promise<void>((resolve) => {
      const req = makeReq()
      const res = makeRes()
      cacheSizeBefore = cache.stats().size
      mw(req, res, () => {
        next1Called = true
        // 模拟 handler 同步调 res.json
        res.json({ data: 'fresh', ts: Date.now() })
        resolve()
      })
      setTimeout(resolve, 1000)
    })

    const cacheSizeAfter = cache.stats().size

    // 第二次:cache HIT,handler 不应被调
    let next2Called = false
    let body2: any = undefined
    await new Promise<void>((resolve) => {
      const req = makeReq()
      const res = makeRes()
      // 截 res.json,因为 cache HIT 时中间件自己会 json
      res.json = (d: any) => { body2 = d; res.body = d; return res }
      mw(req, res, () => { next2Called = true; resolve() })
      setTimeout(resolve, 1000)
    })

    // 第一次应该是 MISS(handler 被调,next 被调)
    expect(next1Called).toBe(true)
    expect(cacheSizeBefore).toBe(0)  // 初始为空
    expect(cacheSizeAfter).toBe(1)   // 第一次写入 cache
    expect(body2).toBeDefined()  // cache 返回的旧 body
    expect(body2.data).toBe('fresh')  // 来自第一次写入
  })
})

describe('health endpoints', () => {
  it('GET /health 返回 ok', async () => {
    const { livenessHandler } = await import('../src/health.js')
    const req = {} as any
    const res: any = {
      statusCode: 200,
      json: vi.fn(),
    }
    livenessHandler(req, res)
    expect(res.json).toHaveBeenCalled()
    const body = (res.json.mock.calls[0] as any)[0]
    expect(body.status).toBe('ok')
    expect(body.uptime).toBeGreaterThanOrEqual(0)
  })

  it('GET /metrics 返回 Prometheus 文本', async () => {
    const { metricsHandler } = await import('../src/health.js')
    const req = {} as any
    const res: any = {
      setHeader: vi.fn(),
      send: vi.fn(),
    }
    metricsHandler(req, res)
    expect(res.send).toHaveBeenCalled()
    const text = (res.send.mock.calls[0] as any)[0] as string
    expect(text).toContain('process_uptime_seconds')
    expect(text).toContain('cache_size')
  })
})
