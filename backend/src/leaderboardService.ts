/**
 * LeaderboardService - 排行榜数据服务
 *
 * 提供的排行榜维度(按 GET /api/leaderboard?type=...):
 *   - hot:         综合热门(交易量 × 交易笔数 × 24h 涨幅 加权得分)
 *   - volume_24h:  24h 交易量排行
 *   - gainers:     24h 涨幅排行
 *   - new:         最新创建
 *   - graduating:  即将毕业(曲线进度 ≥ 80%)
 *   - trending:    7 天增长(交易频率上升)
 *   - creators:    顶级发币者(按发币数)
 *
 * 设计要点:
 *   - 用 SQL 一条 query 出所有维度,避免 N+1
 *   - 用窗口函数计算排行
 *   - 多个维度共享相同的 base query(在 getHot 里展示)
 */
import { query } from './db.js'

export type LeaderboardType = 'hot' | 'volume_24h' | 'gainers' | 'new' | 'graduating' | 'trending' | 'creators'

const CHAIN_NAMES: Record<number, string> = {
  97: 'BSC',
  11155111: 'ETH',
  46630: 'Robinhood',
  5042002: 'Arc',
}

export async function getLeaderboard(
  type: LeaderboardType,
  limit = 50
) {
  switch (type) {
    case 'hot': return getHot(limit)
    case 'volume_24h': return getVolume24h(limit)
    case 'gainers': return getGainers(limit)
    case 'new': return getNew(limit)
    case 'graduating': return getGraduating(limit)
    case 'trending': return getTrending(limit)
    case 'creators': return getCreators(limit)
    default: return []
  }
}

/**
 * 综合热门 = 加权得分
 *   score = log(volume_24h) × 3 + trades_24h × 0.5
 *   LN 压缩大户影响,鼓励真实交易
 *
 * 字段映射:
 *   current_reserve  ← bonding_curves.currency_reserve
 *   total_supply    ← tokens.total_supply
 *   image_url       ← tokens.image_url
 *   label           ← tokens.label
 */
async function getHot(limit: number) {
  return query(
    `WITH stats AS (
       SELECT
         t.address, t.chain_id, t.name, t.symbol, t.label,
         t.image_url, t.creator_address, t.created_at, t.graduated_at,
         t.lock_period,
         bc.currency_reserve AS current_reserve,
         t.total_supply,
         COALESCE(SUM(CASE WHEN pc.interval = '1h' AND pc.open_time >= NOW() - INTERVAL '24 hours'
                          THEN pc.volume ELSE 0 END), 0) AS volume_24h,
         COALESCE(SUM(CASE WHEN pc.interval = '1h' AND pc.open_time >= NOW() - INTERVAL '24 hours'
                          THEN pc.trade_count ELSE 0 END), 0)::int AS trades_24h
       FROM tokens t
       LEFT JOIN bonding_curves bc ON bc.token_address = t.address AND bc.chain_id = t.chain_id
       LEFT JOIN price_candles pc ON pc.token_address = t.address AND pc.chain_id = t.chain_id
       WHERE t.created_at >= NOW() - INTERVAL '30 days'
       GROUP BY t.address, t.chain_id, bc.currency_reserve, t.total_supply
     )
     SELECT
       *,
       (LN(NULLIF(volume_24h::numeric, 0) + 1) * 3 + trades_24h * 0.5)::numeric AS score,
       ROW_NUMBER() OVER (ORDER BY (LN(NULLIF(volume_24h::numeric, 0) + 1) * 3 + trades_24h * 0.5) DESC) AS rank
     FROM stats
     WHERE volume_24h > 0 OR trades_24h > 0
     ORDER BY score DESC
     LIMIT $1`,
    [limit]
  )
}

async function getVolume24h(limit: number) {
  return query(
    `SELECT
       t.address, t.chain_id, t.name, t.symbol, t.label,
       t.image_url, t.creator_address, t.created_at, t.graduated_at,
       t.lock_period,
       bc.currency_reserve AS current_reserve,
       t.total_supply,
       COALESCE(SUM(pc.volume), 0) AS volume_24h,
       COALESCE(SUM(pc.trade_count), 0)::int AS trades_24h,
       ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(pc.volume), 0) DESC) AS rank
     FROM tokens t
     LEFT JOIN bonding_curves bc ON bc.token_address = t.address AND bc.chain_id = t.chain_id
     LEFT JOIN price_candles pc
       ON pc.token_address = t.address AND pc.chain_id = t.chain_id
       AND pc.interval = '1h'
       AND pc.open_time >= NOW() - INTERVAL '24 hours'
     GROUP BY t.address, t.chain_id, bc.currency_reserve, t.total_supply
     HAVING COALESCE(SUM(pc.volume), 0) > 0
     ORDER BY volume_24h DESC
     LIMIT $1`,
    [limit]
  )
}

async function getGainers(limit: number) {
  // 24h 涨幅 = (最新价 - 24h 前价) / 24h 前价 × 100
  return query(
    `WITH latest AS (
       SELECT DISTINCT ON (chain_id, token_address)
         chain_id, token_address, close_price, open_time
       FROM price_candles
       WHERE interval = '1h'
       ORDER BY chain_id, token_address, open_time DESC
     ),
     base_price AS (
       SELECT DISTINCT ON (chain_id, token_address)
         chain_id, token_address, close_price AS base
       FROM price_candles
       WHERE interval = '1h'
         AND open_time <= NOW() - INTERVAL '24 hours'
       ORDER BY chain_id, token_address, open_time DESC
     )
     SELECT
       t.address, t.chain_id, t.name, t.symbol, t.label,
       t.image_url, t.creator_address, t.created_at, t.graduated_at,
       t.lock_period,
       bc.currency_reserve AS current_reserve,
       t.total_supply,
       latest.close_price::numeric AS current_price,
       base_price.base::numeric AS base_price,
       ((latest.close_price::numeric - base_price.base::numeric)
         / NULLIF(base_price.base::numeric, 0) * 100)::numeric AS change_24h,
       ROW_NUMBER() OVER (
         ORDER BY ((latest.close_price::numeric - base_price.base::numeric)
                   / NULLIF(base_price.base::numeric, 0)) DESC
       ) AS rank
     FROM tokens t
     JOIN latest ON latest.token_address = t.address AND latest.chain_id = t.chain_id
     JOIN base_price ON base_price.token_address = t.address AND base_price.chain_id = t.chain_id
     LEFT JOIN bonding_curves bc ON bc.token_address = t.address AND bc.chain_id = t.chain_id
     WHERE base_price.base > 0
     ORDER BY change_24h DESC
     LIMIT $1`,
    [limit]
  )
}

async function getNew(limit: number) {
  return query(
    `SELECT
       t.address, t.chain_id, t.name, t.symbol, t.label,
       t.image_url, t.creator_address, t.created_at, t.graduated_at,
       t.lock_period,
       bc.currency_reserve AS current_reserve,
       t.total_supply,
       0 AS volume_24h, 0 AS trades_24h,
       ROW_NUMBER() OVER (ORDER BY t.created_at DESC) AS rank
     FROM tokens t
     LEFT JOIN bonding_curves bc ON bc.token_address = t.address AND bc.chain_id = t.chain_id
     ORDER BY t.created_at DESC
     LIMIT $1`,
    [limit]
  )
}

async function getGraduating(limit: number) {
  return query(
    `SELECT
       t.address, t.chain_id, t.name, t.symbol, t.label,
       t.image_url, t.creator_address, t.created_at, t.graduated_at,
       t.lock_period,
       bc.currency_reserve AS current_reserve,
       t.total_supply,
       0 AS volume_24h, 0 AS trades_24h,
       ROW_NUMBER() OVER (
         ORDER BY (bc.currency_reserve::numeric / NULLIF(t.total_supply::numeric, 0)) DESC
       ) AS rank,
       (bc.currency_reserve::numeric / NULLIF(t.total_supply::numeric, 0) * 100)::numeric AS progress_percent
     FROM tokens t
     JOIN bonding_curves bc ON bc.token_address = t.address AND bc.chain_id = t.chain_id
     WHERE t.graduated_at IS NULL
       AND bc.currency_reserve > 0
       AND t.total_supply > 0
     ORDER BY progress_percent DESC
     LIMIT $1`,
    [limit]
  )
}

/**
 * 趋势 = 7 天窗口里 K 线数量增长率(交易频率上升的代币)
 */
async function getTrending(limit: number) {
  return query(
    `WITH recent AS (
       SELECT
         chain_id, token_address,
         SUM(trade_count)::int AS trades_7d,
         SUM(volume) AS volume_7d
       FROM price_candles
       WHERE interval = '1h'
         AND open_time >= NOW() - INTERVAL '7 days'
       GROUP BY chain_id, token_address
     ),
     old AS (
       SELECT
         chain_id, token_address,
         SUM(trade_count)::int AS trades_prev_7d
       FROM price_candles
       WHERE interval = '1h'
         AND open_time >= NOW() - INTERVAL '14 days'
         AND open_time < NOW() - INTERVAL '7 days'
       GROUP BY chain_id, token_address
     )
     SELECT
       t.address, t.chain_id, t.name, t.symbol, t.label,
       t.image_url, t.creator_address, t.created_at, t.graduated_at,
       t.lock_period,
       bc.currency_reserve AS current_reserve,
       t.total_supply,
       recent.trades_7d,
       recent.volume_7d::numeric AS volume_7d,
       ((recent.trades_7d - COALESCE(old.trades_prev_7d, 0))::numeric
         / NULLIF(old.trades_prev_7d, 0) * 100)::numeric AS growth_percent,
       ROW_NUMBER() OVER (
         ORDER BY ((recent.trades_7d - COALESCE(old.trades_prev_7d, 0))::numeric
                   / NULLIF(old.trades_prev_7d, 0)) DESC
       ) AS rank
     FROM tokens t
     JOIN recent ON recent.token_address = t.address AND recent.chain_id = t.chain_id
     LEFT JOIN old ON old.token_address = t.address AND old.chain_id = t.chain_id
     LEFT JOIN bonding_curves bc ON bc.token_address = t.address AND bc.chain_id = t.chain_id
     WHERE recent.trades_7d > 10
     ORDER BY growth_percent DESC NULLS LAST
     LIMIT $1`,
    [limit]
  )
}

async function getCreators(limit: number) {
  return query(
    `SELECT
       creator_address AS address,
       MAX(name) AS name,
       'BUIDLER' AS symbol,
       7 AS label,
       NULL AS image_url,
       creator_address,
       MIN(created_at) AS created_at,
       NULL::timestamp AS graduated_at,
       0 AS lock_period,
       0 AS current_reserve,
       0 AS total_supply,
       0 AS volume_24h,
       0 AS trades_24h,
       COUNT(*)::int AS tokens_count,
       ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC) AS rank
     FROM tokens
     GROUP BY creator_address
     ORDER BY tokens_count DESC
     LIMIT $1`,
    [limit]
  )
}

/**
 * 获取所有排行榜摘要(给首页用)
 */
export async function getLeaderboardSummary() {
  const [hot, gainers, new_, graduating] = await Promise.all([
    getHot(5),
    getGainers(5),
    getNew(5),
    getGraduating(5),
  ])
  return { hot, gainers, new: new_, graduating }
}

/**
 * 计算单代币的 mini K 线数据(给排行榜的迷你图)
 */
export async function getMiniSparkline(
  chainId: number,
  token: string,
  points = 24
) {
  const rows = await query(
    `SELECT close_price
     FROM price_candles
     WHERE chain_id = $1 AND token_address = $2 AND interval = '1h'
     ORDER BY open_time DESC
     LIMIT $3`,
    [chainId, token.toLowerCase(), points]
  )
  return rows.reverse().map((r: any) => Number(r.close_price))
}

export { CHAIN_NAMES }
