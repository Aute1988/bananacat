/**
 * api.ts 路由的输入校验逻辑测试
 *
 * ⚠️ 沙箱禁止任何网络操作(socket listen EPERM)
 * 这里直接 require api 模块的 export,然后手动调 routes
 *
 * 我们用极简 mock:
 * - db: 不依赖真实连接,只识别特定 SQL 模式
 * - comments: mock 全部导出
 * - rateLimit / cache / health: mock 透传
 */
import { describe, it, expect, vi } from 'vitest'

// 在 import api 之前 mock 所有依赖
vi.mock('../src/db.js', () => {
  return {
    query: async (text: string) => {
      const t = text.trim()
      if (/^SELECT 1/i.test(t)) return [{ '?column?': 1 }]
      if (/^INSERT INTO notification_subscriptions/i.test(t)) return [{ id: 1 }]
      return []
    },
    queryRaw: async (text: string) => {
      const t = text.trim()
      if (/^INSERT INTO notification_subscriptions/i.test(t)) return { rows: [{ id: 1 }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    },
    pool: { connect: async () => ({ query: async () => ({ rows: [] }), release: () => {} }) },
  }
})

vi.mock('../src/priceCandleService.js', () => ({
  getCandles: async (_chain: number, _addr: string, interval: string) => {
    // interval 校验(应该被 api.ts catch,我们这里只返回 mock 数据)
    return []
  },
  get24hChange: async () => null,
  INTERVALS: ['1m', '5m', '15m', '1h', '4h', '1d'],
}))

vi.mock('../src/leaderboardService.js', () => ({
  getLeaderboard: async () => [],
  getLeaderboardSummary: async () => ({ hot: [], gainers: [], new: [], graduating: [] }),
  getMiniSparkline: async () => [],
}))

vi.mock('../src/comments.js', () => ({
  createComment: vi.fn(async (tokenAddress, chainId, userAddress, content) => ({
    id: 1, token_address: tokenAddress, chain_id: chainId,
    user_address: userAddress, content, parent_id: null,
    upvotes: 0, downvotes: 0, is_deleted: false,
    created_at: new Date(), updated_at: new Date(),
  })),
  getCommentsByToken: vi.fn(async () => []),
  getCommentCount: vi.fn(async () => 0),
  voteComment: vi.fn(async () => {}),
  deleteComment: vi.fn(async () => true),
  reportComment: vi.fn(async () => {}),
}))

// 透传 middleware,避免 express-rate-limit 在测试中卡住
vi.mock('../src/rateLimit.js', () => ({
  globalLimiter: (_req: any, _res: any, next: any) => next(),
  moderateLimiter: (_req: any, _res: any, next: any) => next(),
  relaxedLimiter: (_req: any, _res: any, next: any) => next(),
  strictLimiter: (_req: any, _res: any, next: any) => next(),
  commentLimiter: (_req: any, _res: any, next: any) => next(),
  subscribeLimiter: (_req: any, _res: any, next: any) => next(),
  uploadLimiter: (_req: any, _res: any, next: any) => next(),
}))

vi.mock('../src/cache.js', () => ({
  cacheMiddleware: () => (_req: any, _res: any, next: any) => next(),
  invalidateTokenCache: () => {},
  clearAllCache: () => {},
  cache: {
    get: () => null, set: () => {}, delete: () => {}, clear: () => {},
    has: () => false, stats: () => ({ size: 0, hits: 0, misses: 0 }),
  },
}))

describe('api 输入校验(单元级)', () => {
  let handlers: any
  let app: any

  // 30 秒 timeout
  vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function findRoute(method: string, path: string): any[] | null {
    const stack = (app as any)._router?.stack || []
    return walk(stack, method, path)
  }

  function walk(stack: any[], method: string, path: string): any[] | null {
    for (const layer of stack) {
      if (layer.route) {
        if (layer.route.path === path && Object.keys(layer.route.methods).includes(method.toLowerCase())) {
          return layer.route.stack.map((s: any) => s.handle)
        }
      } else if (layer.handle?.stack) {
        const found = walk(layer.handle.stack, method, path)
        if (found) return found
      }
    }
    return null
  }

  function fillParams(routePath: string, url: string): Record<string, string> {
    const rParts = routePath.split('/')
    const uParts = url.split('?')[0].split('/')
    const params: Record<string, string> = {}
    for (let i = 0; i < rParts.length; i++) {
      const r = rParts[i], u = uParts[i] ?? ''
      if (r.startsWith(':')) params[r.slice(1)] = u
    }
    return params
  }

  function mockReq(method: string, url: string, body?: any) {
    const [path, query] = url.split('?')
    return {
      method: method.toUpperCase(),
      url,
      originalUrl: url,
      path,
      headers: {},
      body: body || {},
      query: query ? Object.fromEntries(new URLSearchParams(query)) : {},
      ip: '127.0.0.1',
      get() { return undefined },
      app: { get: () => undefined },
      params: {} as Record<string, string>,
    } as any
  }

  function mockRes() {
    const res: any = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      body: undefined,
      setHeader(k: string, v: string) { this.headers[k.toLowerCase()] = v; return this },
      status(c: number) { this.statusCode = c; return this },
      json(d: any) { this.body = d; return this },
      send(d: any) { this.body = d; return this },
    }
    return res
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function invoke(routePath: string, method: string, url: string, body?: any) {
    const routeHandlers = findRoute(method, routePath)
    if (!routeHandlers) throw new Error(`Route ${method} ${routePath} not found`)
    const req = mockReq(method, url, body)
    const res = mockRes()
    req.params = fillParams(routePath, url)
    let i = 0
    await new Promise<void>((resolve) => {
      const run = () => {
        if (i >= routeHandlers.length) return resolve()
        const h = routeHandlers[i++]
        try {
          const r = h(req, res, run)
          if (r && typeof r.then === 'function') r.catch(() => resolve())
        } catch { resolve() }
      }
      run()
      setTimeout(resolve, 2000)  // 兜底 timeout
    })
    return { status: res.statusCode, body: res.body }
  }

  // 用 beforeAll 异步 import(避开 sandbox 启动慢问题)
  beforeAll(async () => {
    const mod = await import('../src/api.js')
    app = mod.default
  })

  it('GET /health 返回 ok', async () => {
    const { livenessHandler } = await import('../src/health.js')
    const req = {} as any
    const res = { json: vi.fn() }
    livenessHandler(req, res as any)
    const body = (res.json.mock.calls[0] as any)[0]
    expect(body.status).toBe('ok')
  })

  it('GET /api/chains 返回 4 条链', async () => {
    const r = await invoke('/api/chains', 'GET', '/api/chains')
    expect(r.status).toBe(200)
    expect(r.body.chains).toBeInstanceOf(Array)
    expect(r.body.chains.length).toBe(4)
  })

  describe('POST /api/notifications/subscribe 输入校验', () => {
    it('缺 event_type → 400', async () => {
      const r = await invoke('/api/notifications/subscribe', 'POST', '/api/notifications/subscribe', {
        target_type: 'discord', target_url: 'https://discord.com/api/webhooks/abc/xyz',
      })
      expect(r.status).toBe(400)
      expect(r.body.error).toContain('缺少')
    })

    it('target_type 非法 → 400', async () => {
      const r = await invoke('/api/notifications/subscribe', 'POST', '/api/notifications/subscribe', {
        event_type: 'new_token', target_type: 'twitter', target_url: 'https://example.com',
      })
      expect(r.status).toBe(400)
    })

    it('event_type 非法 → 400', async () => {
      const r = await invoke('/api/notifications/subscribe', 'POST', '/api/notifications/subscribe', {
        event_type: 'haha', target_type: 'discord', target_url: 'https://discord.com/api/webhooks/abc/xyz',
      })
      expect(r.status).toBe(400)
    })

    it('chain_id 非数字 → 400', async () => {
      const r = await invoke('/api/notifications/subscribe', 'POST', '/api/notifications/subscribe', {
        event_type: 'new_token', target_type: 'discord',
        target_url: 'https://discord.com/api/webhooks/abc/xyz', chain_id: 'not-a-number',
      })
      expect(r.status).toBe(400)
    })

    it('Discord URL 不合法 → 400', async () => {
      const r = await invoke('/api/notifications/subscribe', 'POST', '/api/notifications/subscribe', {
        event_type: 'new_token', target_type: 'discord', target_url: 'https://evil.com/steal',
      })
      expect(r.status).toBe(400)
      expect(r.body.error).toContain('Discord')
    })

    it('Telegram 格式错误 → 400', async () => {
      const r = await invoke('/api/notifications/subscribe', 'POST', '/api/notifications/subscribe', {
        event_type: 'new_token', target_type: 'telegram', target_url: 'just-a-string',
      })
      expect(r.status).toBe(400)
    })

    it('合法输入 → 200', async () => {
      const r = await invoke('/api/notifications/subscribe', 'POST', '/api/notifications/subscribe', {
        event_type: 'new_token', target_type: 'discord', target_url: 'https://discord.com/api/webhooks/123/abc',
      })
      expect(r.status).toBe(200)
      expect(r.body.message).toContain('订阅成功')
    })
  })

  describe('POST /api/comments 输入校验', () => {
    it('缺字段 → 400', async () => {
      const r = await invoke('/api/comments', 'POST', '/api/comments', { tokenAddress: '0xtoken' })
      expect(r.status).toBe(400)
    })

    it('userAddress 不是合法地址 → 400', async () => {
      const r = await invoke('/api/comments', 'POST', '/api/comments', {
        tokenAddress: '0xtoken', chainId: 97, userAddress: 'not-an-address', content: 'hi',
      })
      expect(r.status).toBe(400)
    })

    it('content 超过 1000 → 400', async () => {
      const r = await invoke('/api/comments', 'POST', '/api/comments', {
        tokenAddress: '0xtoken', chainId: 97,
        userAddress: '0x1234567890123456789012345678901234567890',
        content: 'x'.repeat(1001),
      })
      expect(r.status).toBe(400)
    })

    it('合法 → 201', async () => {
      const r = await invoke('/api/comments', 'POST', '/api/comments', {
        tokenAddress: '0xtoken', chainId: 97,
        userAddress: '0x1234567890123456789012345678901234567890',
        content: 'hello',
      })
      expect(r.status).toBe(201)
    })
  })

  describe('GET /api/tokens/:chainId/:address/candles', () => {
    it('interval 非法 → 400', async () => {
      const r = await invoke('/api/tokens/:chainId/:address/candles', 'GET', '/api/tokens/97/0xtoken/candles?interval=invalid')
      expect(r.status).toBe(400)
    })

    it('合法 interval → 200', async () => {
      const r = await invoke('/api/tokens/:chainId/:address/candles', 'GET', '/api/tokens/97/0xtoken/candles?interval=1h&limit=10')
      expect(r.status).toBe(200)
    })
  })
})
