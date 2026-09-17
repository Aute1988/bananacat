import express from 'express'
import cors from 'cors'
import pino from 'pino'
import { query } from './db.js'
import { CHAINS } from './chains.js'
import { getCandles, get24hChange, INTERVALS } from './priceCandleService.js'
import { getLeaderboard, getLeaderboardSummary, getMiniSparkline, LeaderboardType } from './leaderboardService.js'
import {
  createComment, getCommentsByToken, getCommentCount,
  voteComment, deleteComment, reportComment,
} from './comments.js'
import {
  globalLimiter, moderateLimiter, relaxedLimiter,
  commentLimiter, subscribeLimiter, uploadLimiter, strictLimiter,
} from './rateLimit.js'
import { cacheMiddleware, invalidateTokenCache } from './cache.js'
import { livenessHandler, readinessHandler, metricsHandler } from './health.js'
import { authMiddleware, generateChallenge } from './auth.js'

const log = pino({ transport: { target: 'pino-pretty' } })
const app = express()

// 🆕 修复 M-8: 配置 trust proxy,正确读取 nginx/cloudflare 反代后的真实客户端 IP
app.set('trust proxy', Number(process.env.TRUST_PROXY || 1))

// 🆕 修复 H-5: CORS 默认禁用,只在 CORS_ORIGIN 配置后启用白名单
//              避免 origin: '*' + credentials: true 的危险组合
const corsOrigins = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean)
if (corsOrigins.length > 0) {
  app.use(cors({
    origin: corsOrigins,
    credentials: true,
    maxAge: 86400,  // 缓存 preflight 24h
  }))
}

app.use(express.json({ limit: '100kb' }))  // 🆕 修复 M-9: 全局限制 100kb,防止大 body 攻击

// 🆕 修复 L-9: 手动添加安全 headers(不引入 helmet 减少依赖)
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('X-DNS-Prefetch-Control', 'off')
  // HSTS(只在生产用 HTTPS 时生效,本地 dev 会忽略)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
  // CSP(API 服务主要是 JSON,不需要 script/connect 等复杂规则)
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")
  next()
})

// 🆕 全局速率限制兜底(跳过 health)
app.use(globalLimiter)

// 🆕 全局错误处理中间件(防止崩溃)
app.use((err: any, _req: any, res: any, _next: any) => {
  log.error({ err }, '未捕获错误')
  res.status(500).json({ error: '服务器内部错误' })
})

// ============================================================
// REST API
// ============================================================

// GET /api/tokens - 获取代币列表(支持分页/筛选)
app.get('/api/tokens', async (req, res) => {
  const chainId = req.query.chain_id ? Number(req.query.chain_id) : null
  const graduated = req.query.graduated === 'true' ? true : req.query.graduated === 'false' ? false : null
  const limit = Math.min(Number(req.query.limit) || 50, 100)
  const offset = Number(req.query.offset) || 0
  const search = req.query.search ? `%${req.query.search}%` : null

  try {
    const conditions: string[] = []
    const params: any[] = []

    if (chainId) {
      params.push(chainId)
      conditions.push(`t.chain_id = $${params.length}`)
    }
    if (graduated !== null) {
      params.push(graduated)
      conditions.push(`t.graduated_at IS ${graduated ? 'NOT' : ''} NULL`)
    }
    if (search) {
      params.push(search)
      conditions.push(`(t.name ILIKE $${params.length} OR t.symbol ILIKE $${params.length})`)
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    params.push(limit, offset)
    const rows = await query(
      `SELECT t.*, bc.currency_reserve, bc.tokens_sold, bc.graduation_target
       FROM tokens t
       LEFT JOIN bonding_curves bc ON t.address = bc.token_address AND t.chain_id = bc.chain_id
       ${whereClause}
       ORDER BY t.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    )

    res.json({ tokens: rows, total: rows.length })
  } catch (err: any) {
    log.error({ err }, '获取代币列表失败')
    res.status(500).json({ error: err.message })
  }
})

// GET /api/tokens/:chainId/:address - 代币详情
app.get('/api/tokens/:chainId/:address', async (req, res) => {
  const chainId = Number(req.params.chainId)
  const address = req.params.address.toLowerCase()

  try {
    const tokens = await query(
      `SELECT t.*, bc.currency_reserve, bc.tokens_sold, bc.graduation_target, bc.graduated
       FROM tokens t
       LEFT JOIN bonding_curves bc ON t.address = bc.token_address AND t.chain_id = bc.chain_id
       WHERE t.chain_id = $1 AND LOWER(t.address) = $2`,
      [chainId, address]
    )

    if (tokens.length === 0) {
      return res.status(404).json({ error: '代币不存在' })
    }

    // 锁仓信息
    const locks = await query(
      `SELECT * FROM lp_locks WHERE chain_id = $1 AND LOWER(token_address) = $2`,
      [chainId, address]
    )

    // 最近 20 笔交易
    const trades = await query(
      `SELECT * FROM trades WHERE chain_id = $1 AND LOWER(token_address) = $2
       ORDER BY timestamp DESC LIMIT 20`,
      [chainId, address]
    )

    res.json({
      token: tokens[0],
      locks,
      recentTrades: trades,
    })
  } catch (err: any) {
    log.error({ err }, '获取代币详情失败')
    res.status(500).json({ error: err.message })
  }
})

// GET /api/tokens/:chainId/:address/trades - 交易历史
app.get('/api/tokens/:chainId/:address/trades', async (req, res) => {
  const chainId = Number(req.params.chainId)
  const address = req.params.address.toLowerCase()
  const limit = Math.min(Number(req.query.limit) || 50, 200)

  try {
    const trades = await query(
      `SELECT * FROM trades WHERE chain_id = $1 AND LOWER(token_address) = $2
       ORDER BY timestamp DESC LIMIT $3`,
      [chainId, address, limit]
    )
    res.json({ trades })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/creator/:address/tokens - 查询某地址创建的代币
app.get('/api/creator/:address/tokens', async (req, res) => {
  const address = req.params.address.toLowerCase()

  try {
    const tokens = await query(
      `SELECT t.*, bc.currency_reserve, bc.tokens_sold
       FROM tokens t
       LEFT JOIN bonding_curves bc ON t.address = bc.token_address AND t.chain_id = bc.chain_id
       WHERE LOWER(t.creator_address) = $1
       ORDER BY t.created_at DESC`,
      [address]
    )

    // 锁仓信息
    const tokensWithLocks = await Promise.all(
      tokens.map(async (t: any) => {
        const locks = await query(
          `SELECT * FROM lp_locks WHERE chain_id = $1 AND LOWER(token_address) = $2`,
          [t.chain_id, t.address]
        )
        return { ...t, locks }
      })
    )

    res.json({ tokens: tokensWithLocks })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/creator/:address/locks - 查询某地址的所有锁仓
app.get('/api/creator/:address/locks', async (req, res) => {
  const address = req.params.address.toLowerCase()

  try {
    const locks = await query(
      `SELECT l.*, t.name as token_name, t.symbol as token_symbol
       FROM lp_locks l
       JOIN tokens t ON l.token_address = t.address AND l.chain_id = t.chain_id
       WHERE LOWER(l.creator_address) = $1
       ORDER BY l.created_at DESC`,
      [address]
    )
    res.json({ locks })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/chains - 获取所有链配置(缓存 5 分钟)
app.get('/api/chains', moderateLimiter, cacheMiddleware(5 * 60 * 1000), (req, res) => {
  res.json({ chains: CHAINS })
})

// GET /api/stats - 平台统计(缓存 30 秒)
app.get('/api/stats', moderateLimiter, cacheMiddleware(30 * 1000), async (req, res) => {
  try {
    const tokensCount = await query<{ count: string }>(`SELECT COUNT(*) as count FROM tokens`)
    const tradesCount = await query<{ count: string }>(`SELECT COUNT(*) as count FROM trades`)
    const lockedLPs = await query<{ sum: string }>(`SELECT COALESCE(SUM(lp_amount), 0) as sum FROM lp_locks WHERE period != 5 AND NOT claimed`)
    const burnedLPs = await query<{ sum: string }>(`SELECT COALESCE(SUM(lp_amount), 0) as sum FROM lp_locks WHERE period = 5`)

    res.json({
      totalTokens: Number(tokensCount[0].count),
      totalTrades: Number(tradesCount[0].count),
      totalLPLocked: lockedLPs[0].sum,
      totalLPBurned: burnedLPs[0].sum,
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// 健康检查端点
app.get('/health', relaxedLimiter, livenessHandler)
app.get('/health/ready', relaxedLimiter, readinessHandler)
app.get('/metrics', relaxedLimiter, metricsHandler)

// ============================================================
// 🆕 价格蜡烛 API(给前端图表用)
// ============================================================

// GET /api/tokens/:chainId/:address/candles?interval=1m&limit=100
app.get('/api/tokens/:chainId/:address/candles', async (req, res) => {
  const chainId = Number(req.params.chainId)
  const address = req.params.address.toLowerCase()
  const interval = (req.query.interval || '1m') as string
  const limit = Math.min(Number(req.query.limit) || 100, 500)

  // 🆕 interval 必须白名单,防御错误输入
  if (!INTERVALS.includes(interval as any)) {
    return res.status(400).json({ error: `interval 必须是: ${INTERVALS.join(', ')}` })
  }

  try {
    const candles = await getCandles(chainId, address, interval as any, limit)
    res.json({ candles: candles.reverse() }) // 倒序回来,前端按时间正序显示
  } catch (err: any) {
    log.error({ err }, '获取 K 线失败')
    res.status(500).json({ error: err.message })
  }
})

// GET /api/tokens/:chainId/:address/stats - 完整市场数据
app.get('/api/tokens/:chainId/:address/stats', async (req, res) => {
  const chainId = Number(req.params.chainId)
  const address = req.params.address.toLowerCase()

  try {
    const change24h = await get24hChange(chainId, address)
    const stats24h = await query(
      `SELECT
         COALESCE(SUM(volume), 0) as volume_24h,
         COALESCE(SUM(trade_count), 0) as trades_24h
       FROM price_candles
       WHERE chain_id = $1 AND token_address = $2
         AND interval = '1h' AND open_time >= NOW() - INTERVAL '24 hours'`,
      [chainId, address]
    )
    const allTime = await query(
      `SELECT
         COALESCE(SUM(volume), 0) as volume_all,
         COALESCE(SUM(trade_count), 0) as trades_all
       FROM price_candles
       WHERE chain_id = $1 AND token_address = $2`,
      [chainId, address]
    )

    res.json({
      change24h,
      volume24h: stats24h[0]?.volume_24h || '0',
      trades24h: Number(stats24h[0]?.trades_24h || 0),
      volumeAll: allTime[0]?.volume_all || '0',
      tradesAll: Number(allTime[0]?.trades_all || 0),
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ============================================================
// 🆕 通知订阅管理 API
// ============================================================

// POST /api/notifications/subscribe - 订阅一个事件
app.post('/api/notifications/subscribe', subscribeLimiter, async (req, res) => {
  const { event_type, target_type, target_url, chain_id } = req.body

  if (!event_type || !target_type || !target_url) {
    return res.status(400).json({ error: '缺少必填字段: event_type, target_type, target_url' })
  }
  if (!['discord', 'telegram'].includes(target_type)) {
    return res.status(400).json({ error: 'target_type 必须是 discord 或 telegram' })
  }

  const validEvents = ['new_token', 'graduation', 'large_trade', 'lock_burn']
  if (!validEvents.includes(event_type)) {
    return res.status(400).json({ error: `event_type 必须是: ${validEvents.join(', ')}` })
  }

  // 🆕 校验 chain_id(必须是合法整数或 null)
  let chainIdValue: number | null = null
  if (chain_id !== undefined && chain_id !== null) {
    chainIdValue = Number(chain_id)
    if (!Number.isInteger(chainIdValue) || chainIdValue < 0) {
      return res.status(400).json({ error: 'chain_id 必须是正整数或 null' })
    }
  }

  // 🆕 修复 M-7: 严格校验 webhook URL,防止 SSRF(不能是内网地址)
  if (target_type === 'discord') {
    if (!validateDiscordWebhook(target_url)) {
      return res.status(400).json({ error: 'Discord webhook URL 不合法' })
    }
  }
  if (target_type === 'telegram') {
    if (!validateTelegramConfig(target_url)) {
      return res.status(400).json({ error: 'Telegram 配置格式: BOT_TOKEN|CHAT_ID' })
    }
  }

  try {
    const result = await query<{ id: number }>(
      `INSERT INTO notification_subscriptions (event_type, target_type, target_url, chain_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [event_type, target_type, target_url, chainIdValue]
    )
    res.json({ id: result[0].id, message: '订阅成功' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/notifications/subscriptions - 列出所有订阅
app.get('/api/notifications/subscriptions', async (req, res) => {
  try {
    const subs = await query(
      `SELECT * FROM notification_subscriptions ORDER BY created_at DESC`
    )
    res.json({ subscriptions: subs })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/notifications/subscriptions/:id - 取消订阅
app.delete('/api/notifications/subscriptions/:id', async (req, res) => {
  try {
    await query(
      `UPDATE notification_subscriptions SET enabled = FALSE WHERE id = $1`,
      [Number(req.params.id)]
    )
    res.json({ message: '已取消订阅' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/notifications/history - 通知历史
// ============================================================
// 🆕 IPFS 上传 API(代币 Logo)
// ============================================================

// 上传 Base64 图片(简化版:前端把图片转 base64 后 post)
app.post('/api/upload/base64', uploadLimiter, async (req, res) => {
  try {
    const { dataUrl, filename = 'logo.png' } = req.body

    if (!dataUrl || !dataUrl.startsWith('data:')) {
      return res.status(400).json({ error: '需要 dataUrl 格式(base64)' })
    }

    const match = dataUrl.match(/^data:(.+);base64,(.+)$/)
    if (!match) return res.status(400).json({ error: 'Base64 格式错误' })

    const mimeType = match[1]
    if (!mimeType.startsWith('image/')) {
      return res.status(400).json({ error: '只支持图片文件' })
    }
    // 🆕 修复 M-9: 校验真实 MIME 类型白名单(防止 image/zip 等恶意伪装)
    const ALLOWED_MIMES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']
    if (!ALLOWED_MIMES.includes(mimeType)) {
      return res.status(400).json({ error: `不支持的 MIME: ${mimeType},只允许 ${ALLOWED_MIMES.join(', ')}` })
    }

    const buffer = Buffer.from(match[2], 'base64')
    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: '文件过大(上限 5MB)' })
    }
    // 🆕 修复 M-9: 校验 magic bytes,确保真的是声称的图片类型(防止 shellcode 伪装)
    if (!verifyMagicBytes(buffer, mimeType)) {
      return res.status(400).json({ error: '文件内容与声称的 MIME 类型不匹配' })
    }

    const { uploadToIPFS } = await import('./ipfs.js')
    const result = await uploadToIPFS(buffer, filename, mimeType)
    res.json(result)
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

// 查询 CID 信息(不实际上传,只返回可访问 gateway)
app.get('/api/ipfs/info/:cid', async (req, res) => {
  const { cid } = req.params
  res.json({
    cid,
    gateways: [
      `https://ipfs.io/ipfs/${cid}`,
      `https://gateway.pinata.cloud/ipfs/${cid}`,
      `https://cloudflare-ipfs.com/ipfs/${cid}`,
      `https://dweb.link/ipfs/${cid}`,
    ],
    ipfsUri: `ipfs://${cid}`,
  })
})

// ============================================================
// 🆕 Dashboard 统计 API
// ============================================================

// GET /api/stats/overview - 全局总览(总代币/总交易量/24h 活动...)
app.get('/api/stats/overview', async (_req, res) => {
  try {
    const stats = await query(`
      WITH vol AS (
        SELECT
          token_address,
          SUM(volume) AS volume_24h,
          SUM(trade_count) AS trades_24h,
          SUM(volume) AS total_volume
        FROM price_candles
        WHERE interval = '1h'
        GROUP BY token_address
      )
      SELECT
        COUNT(DISTINCT t.id)::int AS total_tokens,
        COALESCE(SUM(CASE WHEN t.graduated_at IS NOT NULL THEN 1 ELSE 0 END), 0)::int AS graduated_tokens,
        COALESCE(SUM(CASE WHEN t.created_at >= NOW() - INTERVAL '24 hours' THEN 1 ELSE 0 END), 0)::int AS new_tokens_24h,
        COALESCE(SUM(CASE WHEN t.graduated_at >= NOW() - INTERVAL '24 hours' THEN 1 ELSE 0 END), 0)::int AS graduations_24h,
        COALESCE(SUM(vol.total_volume), 0) AS total_volume,
        COALESCE(SUM(vol.volume_24h), 0) AS volume_24h,
        COALESCE(SUM(vol.trades_24h), 0)::int AS trades_24h,
        COALESCE(SUM(CASE WHEN t.lock_period = 5 THEN 1 ELSE 0 END), 0)::int AS permanent_locks
      FROM tokens t
      LEFT JOIN vol ON vol.token_address = t.address
    `)
    res.json(stats[0] || {})
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/stats/timeseries?days=7 - 代币增长曲线
app.get('/api/stats/timeseries', async (req, res) => {
  const days = Math.min(Number(req.query.days) || 7, 90)
  try {
    const series = await query(
      `SELECT
         DATE(created_at) AS day,
         COUNT(*)::int AS new_tokens,
         COALESCE(SUM(CASE WHEN graduated_at IS NOT NULL THEN 1 ELSE 0 END), 0)::int AS graduations
       FROM tokens
       WHERE created_at >= NOW() - ($1 || ' days')::interval
       GROUP BY DATE(created_at)
       ORDER BY day ASC`,
      [days.toString()]
    )
    res.json({ series, days })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/stats/by-category - 分类排行
app.get('/api/stats/by-category', async (_req, res) => {
  try {
    const categories = await query(
      `SELECT
         t.label,
         COUNT(*)::int AS count,
         COALESCE(SUM(vol.total_volume), 0) AS volume,
         COALESCE(SUM(vol.trades), 0)::int AS trades
       FROM tokens t
       LEFT JOIN (
         SELECT token_address, SUM(volume) AS total_volume, SUM(trade_count) AS trades
         FROM price_candles WHERE interval = '1h' GROUP BY token_address
       ) vol ON vol.token_address = t.address
       GROUP BY t.label
       ORDER BY count DESC`
    )
    res.json({ categories })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/stats/top-tokens?sortBy=volume - 热门代币
app.get('/api/stats/top-tokens', async (req, res) => {
  const sortBy = req.query.sortBy === 'trades' ? 'trades' : 'volume'
  // ⚠️ 安全:sortBy 必须是白名单值,这里用 `if-else` 替换模板字符串
  // 防止 SQL 注入
  const orderByCol = sortBy === 'trades' ? 'total_trades' : 'total_volume'
  try {
    const top = await query(
      `SELECT
         t.address, t.name, t.symbol, t.label, t.chain_id, t.graduated_at, t.image_url,
         COALESCE(vol.total_volume, 0) AS total_volume,
         COALESCE(vol.total_trades, 0)::int AS total_trades
       FROM tokens t
       LEFT JOIN (
         SELECT token_address,
                SUM(volume) AS total_volume,
                SUM(trade_count) AS total_trades
         FROM price_candles WHERE interval = '1h'
         GROUP BY token_address
       ) vol ON vol.token_address = t.address
       ORDER BY vol.${orderByCol} DESC NULLS LAST
       LIMIT 20`
    )
    res.json({ tokens: top, sortBy })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/stats/by-chain - 按链统计
app.get('/api/stats/by-chain', async (_req, res) => {
  try {
    const chains = await query(
      `SELECT
         t.chain_id,
         COUNT(DISTINCT t.id)::int AS tokens,
         COALESCE(SUM(vol.vol), 0) AS volume
       FROM tokens t
       LEFT JOIN (
         SELECT token_address, SUM(volume) AS vol
         FROM price_candles WHERE interval = '1h' GROUP BY token_address
       ) vol ON vol.token_address = t.address
       GROUP BY t.chain_id`
    )
    res.json({ chains })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// 通知历史(保留在末尾)
app.get('/api/notifications/history', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200)
  try {
    const history = await query(
      `SELECT * FROM notification_history ORDER BY sent_at DESC LIMIT $1`,
      [limit]
    )
    res.json({ history })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ============================================================
// 🆕 排行榜 API
// ============================================================

const VALID_LEADERBOARD_TYPES: LeaderboardType[] = [
  'hot', 'volume_24h', 'gainers', 'new', 'graduating', 'trending', 'creators',
]

// GET /api/leaderboard?type=hot&limit=50(缓存 60 秒)
app.get('/api/leaderboard', moderateLimiter, cacheMiddleware(60 * 1000), async (req, res) => {
  const type = (req.query.type || 'hot') as LeaderboardType
  const limit = Math.min(Number(req.query.limit) || 50, 100)

  if (!VALID_LEADERBOARD_TYPES.includes(type)) {
    return res.status(400).json({
      error: `type 必须是: ${VALID_LEADERBOARD_TYPES.join(', ')}`,
    })
  }

  try {
    const rows = await getLeaderboard(type, limit)
    res.json({
      type,
      limit,
      updatedAt: new Date().toISOString(),
      entries: rows.map((r: any) => ({
        rank: Number(r.rank),
        address: r.address,
        chainId: r.chain_id,
        chainName: r.chain_id === 97 ? 'BSC' :
                   r.chain_id === 11155111 ? 'ETH' :
                   r.chain_id === 46630 ? 'Robinhood' :
                   r.chain_id === 5042002 ? 'Arc' : `Chain ${r.chain_id}`,
        name: r.name,
        symbol: r.symbol,
        label: r.label,
        imageUrl: r.image_url,
        creatorAddress: r.creator_address,
        createdAt: r.created_at,
        graduatedAt: r.graduated_at,
        currentReserve: r.current_reserve,
        totalSupply: r.total_supply,
        lockPeriod: r.lock_period,
        volume24h: r.volume_24h || '0',
        trades24h: r.trades_24h || 0,
        score: r.score ? Number(r.score) : null,
        change24h: r.change_24h ? Number(r.change_24h) : null,
        progressPercent: r.progress_percent ? Number(r.progress_percent) : null,
        tokensCount: r.tokens_count,
      })),
    })
  } catch (err: any) {
    log.error({ err, type }, '获取排行榜失败')
    res.status(500).json({ error: err.message })
  }
})

// GET /api/leaderboard/summary - 首页卡片用的摘要(缓存 60 秒)
app.get('/api/leaderboard/summary', moderateLimiter, cacheMiddleware(60 * 1000), async (_req, res) => {
  try {
    const summary = await getLeaderboardSummary()
    res.json({ ...summary, updatedAt: new Date().toISOString() })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/leaderboard/sparkline/:chainId/:address?points=24
app.get('/api/leaderboard/sparkline/:chainId/:address', async (req, res) => {
  const chainId = Number(req.params.chainId)
  const address = req.params.address.toLowerCase()
  const points = Math.min(Number(req.query.points) || 24, 100)
  try {
    const data = await getMiniSparkline(chainId, address, points)
    res.json({ data, points: data.length })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ============================================================
// 🆕 代币评论系统 API
// ============================================================

// GET /api/comments/:chainId/:address?sort=top&limit=20&offset=0
app.get('/api/comments/:chainId/:address', async (req, res) => {
  const chainId = Number(req.params.chainId)
  const address = req.params.address.toLowerCase()
  const sortBy = req.query.sort === 'latest' ? 'latest' : 'top'
  const limit = Math.min(Number(req.query.limit) || 20, 100)
  const offset = Number(req.query.offset) || 0

  try {
    const [comments, total] = await Promise.all([
      getCommentsByToken(address, chainId, sortBy, limit, offset),
      getCommentCount(address, chainId),
    ])
    res.json({ comments, total, sortBy, limit, offset })
  } catch (err: any) {
    log.error({ err, chainId, address }, '获取评论失败')
    res.status(500).json({ error: err.message })
  }
})

// GET /api/comments/:chainId/:address/count
app.get('/api/comments/:chainId/:address/count', async (req, res) => {
  try {
    const count = await getCommentCount(
      req.params.address.toLowerCase(),
      Number(req.params.chainId)
    )
    res.json({ count })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/auth/challenge - 生成签名挑战(前端用钱包签这个)
app.post('/api/auth/challenge', relaxedLimiter, (req, res) => {
  const { address } = req.body
  if (!address) return res.status(400).json({ error: '需要 address' })
  try {
    const challenge = generateChallenge(address)
    res.json(challenge)
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

// POST /api/comments - 发评论
app.post('/api/comments', commentLimiter, authMiddleware, async (req, res) => {
  const { tokenAddress, chainId, content, parentId } = req.body
  // 🆕 修复 H-4: userAddress 必须从已验证的 req.userAddress 取,绝不信任客户端
  const userAddress = (req as any).userAddress as string

  if (!tokenAddress || !chainId || !userAddress || !content) {
    return res.status(400).json({ error: '缺少必要参数' })
  }
  if (typeof content !== 'string' || content.length > 1000) {
    return res.status(400).json({ error: '评论内容必须是字符串,最多 1000 字' })
  }

  try {
    const comment = await createComment(tokenAddress, chainId, userAddress, content, parentId)
    // 🆕 写操作后失效对应 token 的缓存
    invalidateTokenCache(Number(chainId), tokenAddress)
    res.status(201).json({ comment })
  } catch (err: any) {
    // 🆕 业务校验错误返回 400
    if (err.message.includes('不存在') || err.message.includes('不匹配') || err.message.includes('嵌套')) {
      return res.status(400).json({ error: err.message })
    }
    log.error({ err }, '创建评论失败')
    res.status(500).json({ error: '服务器内部错误' })
  }
})

// POST /api/comments/:id/vote - 点赞/点踩
app.post('/api/comments/:id/vote', commentLimiter, authMiddleware, async (req, res) => {
  const { vote } = req.body
  const commentId = Number(req.params.id)
  const userAddress = (req as any).userAddress as string

  if (!['up', 'down', 'none'].includes(vote)) {
    return res.status(400).json({ error: 'vote 必须是 up|down|none' })
  }

  try {
    await voteComment(commentId, userAddress, vote)
    res.json({ ok: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/comments/:id - 删除评论(只能删自己的)
app.delete('/api/comments/:id', strictLimiter, authMiddleware, async (req, res) => {
  const commentId = Number(req.params.id)
  // 🆕 修复 H-4: 从已验证的 req.userAddress 取地址
  const userAddress = (req as any).userAddress as string

  try {
    const ok = await deleteComment(commentId, userAddress)
    if (!ok) return res.status(403).json({ error: '只能删除自己的评论' })
    res.json({ ok: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/comments/:id/report - 举报评论
app.post('/api/comments/:id/report', commentLimiter, authMiddleware, async (req, res) => {
  const commentId = Number(req.params.id)
  const { reason } = req.body
  // 🆕 修复 H-4: reporterAddress 从已验证 req 取
  const reporterAddress = (req as any).userAddress as string

  if (!reason || typeof reason !== 'string' || reason.length > 500) {
    return res.status(400).json({ error: 'reason 必填,最多 500 字' })
  }

  try {
    await reportComment(commentId, reporterAddress, reason)
    res.json({ ok: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ============================================================
// 🆕 v4 修复 (CRITICAL): /api/locks/:lockId - LPUnlockPage 必须
//      之前这个 endpoint 完全缺失,导致 LPUnlockPage 拿不到 lock 数据
//      用户访问解锁页面永远显示"锁仓记录不存在"
// ============================================================
app.get('/api/locks/:lockId', moderateLimiter, cacheMiddleware(60 * 1000), async (req, res) => {
  try {
    const { lockId } = req.params
    if (!lockId || !/^0x[0-9a-fA-F]{64}$/.test(lockId)) {
      return res.status(400).json({ error: 'lockId 必须是 0x + 64 hex 字符' })
    }

    const lockIdLower = lockId.toLowerCase()

    // 1. 主锁仓记录
    const lockRows = await query<any>(`
      SELECT
        l.lock_id, l.token_address, l.creator_address,
        l.period, l.unlock_timestamp, l.claimed, l.created_at,
        t.name as token_name, t.symbol as token_symbol,
        t.image_url as token_image_url, t.graduated_at,
        t.chain_id,
        l.creator_address,
        l.lp_amount
      FROM lp_locks l
      LEFT JOIN tokens t ON l.chain_id = t.chain_id AND t.address = l.token_address
      WHERE l.lock_id = $1
      LIMIT 1
    `, [lockIdLower])

    if (!lockRows.length) {
      return res.status(404).json({ error: '锁仓记录不存在' })
    }

    const row = lockRows[0]

    // 2. 推导状态(前端用)
    const period = Number(row.period)
    const unlockTs = row.unlock_timestamp ? Number(row.unlock_timestamp) : 0
    const nowSec = Math.floor(Date.now() / 1000)
    const claimed = !!row.claimed
    const isPermanent = period === 5
    const canClaim = !claimed && !isPermanent && nowSec >= unlockTs
    const canExtend = !claimed && !isPermanent && nowSec >= unlockTs
    const canBurn = !claimed && !isPermanent

    // 3. 期限标签
    const periodLabels: Record<number, string> = {
      0: '不锁仓', 1: '1 天', 2: '7 天', 3: '30 天', 4: '365 天', 5: '永久销毁',
    }

    // 4. 链 key (frontend 用)
    const chainKeyMap: Record<number, string> = {
      97: 'bsc',
      11155111: 'ethereum',
      46630: 'robinhood',
      5042002: 'arc',
    }

    res.json({
      lock: {
        lockId: row.lock_id,
        token: {
          address: row.token_address,
          name: row.token_name || 'Unknown Token',
          symbol: row.token_symbol || '???',
          imageUrl: row.token_image_url || '',
          chainId: row.chain_id,
          chainKey: chainKeyMap[row.chain_id] || 'bsc',
        },
        creator: row.creator_address,
        lpAmount: row.lp_amount,  // wei 字符串
        lpTokenSymbol: 'PancakeSwap LP',  // 简化版,生产可从合约查 symbol
        period,
        periodLabel: periodLabels[period] || 'Unknown',
        unlockTimestamp: unlockTs,
        claimed,
        isPermanent,
        canClaim,
        canExtend,
        canBurn,
        graduated: !!row.graduated_at,
        // 🆕 lockerAddress & lpTokenAddress 需要从 LPLocker 合约查询
        //      这里简化返回空,前端 LPUnlockPage 仍走链上交互,所以不影响核心功能
        lockerAddress: '',
        lpTokenAddress: '',
      }
    })
  } catch (err: any) {
    log.error({ err, lockId: req.params.lockId }, '查询锁仓记录失败')
    res.status(500).json({ error: '服务器内部错误' })
  }
})

// GET /api/users/:address/locks - 某个 creator 的所有锁仓
app.get('/api/users/:address/locks', moderateLimiter, cacheMiddleware(60 * 1000), async (req, res) => {
  try {
    const address = req.params.address.toLowerCase()
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      return res.status(400).json({ error: 'address 格式不正确' })
    }

    const rows = await query<any>(`
      SELECT
        lock_id, token_address, period, unlock_timestamp, claimed, lp_amount, created_at
      FROM lp_locks
      WHERE creator_address = $1
      ORDER BY created_at DESC
      LIMIT 200
    `, [address])

    res.json({
      locks: rows.map(r => ({
        lockId: r.lock_id,
        tokenAddress: r.token_address,
        period: Number(r.period),
        unlockTimestamp: r.unlock_timestamp ? Number(r.unlock_timestamp) : 0,
        claimed: !!r.claimed,
        lpAmount: r.lp_amount,
        createdAt: r.created_at,
      }))
    })
  } catch (err: any) {
    log.error({ err, address: req.params.address }, '查询用户锁仓失败')
    res.status(500).json({ error: '服务器内部错误' })
  }
})

// ============================================================
// 🆕 Webhook URL / Magic Bytes 校验辅助函数
// ============================================================

/**
 * 验证 Discord webhook URL 合法性,防止 SSRF
 * - 必须是 https://discord.com/api/webhooks/ 开头
 * - 不能再带 @ 或路径穿透(例如 https://discord.com/api/webhooks/@evil.com/)
 * - URL 必须能被解析
 */
function validateDiscordWebhook(url: string): boolean {
  if (typeof url !== 'string') return false
  if (!url.startsWith('https://discord.com/api/webhooks/')) return false
  // 解析 URL,确保 hostname 严格是 discord.com(防 tricks)
  try {
    const u = new URL(url)
    if (u.hostname !== 'discord.com' && u.hostname !== 'discordapp.com') return false
    if (u.protocol !== 'https:') return false
    return true
  } catch {
    return false
  }
}

/**
 * 验证 Telegram 配置 "BOT_TOKEN|CHAT_ID"
 */
function validateTelegramConfig(config: string): boolean {
  if (typeof config !== 'string') return false
  return /^\d+:[A-Za-z0-9_-]+\|-\d+$/.test(config)
}

/**
 * 校验文件 magic bytes 是否与声称的 MIME 匹配
 * 防止用户把 shellcode 命名成 image/png 绕过
 */
function verifyMagicBytes(buffer: Buffer, claimedMime: string): boolean {
  if (buffer.length < 8) return false
  if (claimedMime === 'image/png') {
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47
  }
  if (claimedMime === 'image/jpeg') {
    // JPEG: FF D8 FF
    return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF
  }
  if (claimedMime === 'image/gif') {
    // GIF: 47 49 46 38(37/39)
    return buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38
  }
  if (claimedMime === 'image/webp') {
    // WEBP: RIFF....WEBP
    return buffer.toString('ascii', 0, 4) === 'RIFF' &&
           buffer.toString('ascii', 8, 12) === 'WEBP'
  }
  if (claimedMime === 'image/svg+xml') {
    // SVG 是文本,可包含 <?xml 或 <svg
    const head = buffer.toString('utf8', 0, Math.min(64, buffer.length))
    return head.includes('<svg') || head.includes('<?xml')
  }
  return false
}

export default app
