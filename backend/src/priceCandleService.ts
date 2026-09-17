/**
 * PriceCandleService - 价格蜡烛(K线)聚合服务
 *
 * 职责:
 *  - 监听 trades 表的新交易,实时聚合成多个时间间隔的 K 线
 *  - 支持 interval: 1m / 5m / 15m / 1h / 4h / 1d
 *  - 提供 OHLCV(开/高/低/收/量) + 市值 数据
 *
 * 工作原理:
 *   新交易到来 → 计算当前 K 线桶(open_time) → UPSERT 更新 OHLCV
 *   注意:用 PostgreSQL 的 ON CONFLICT + GREATEST/LEAST 保证并发安全
 */
import { query, db } from './db.js'
import pino from 'pino'

const log = pino({ transport: { target: 'pino-pretty' } })

const INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d'] as const

type Interval = typeof INTERVALS[number]

// interval → PostgreSQL 时间桶(秒)
const INTERVAL_SECONDS: Record<Interval, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '4h': 14400,
  '1d': 86400,
}

/**
 * 把时间戳归桶到 interval 边界
 */
function alignToBucket(timestamp: Date, interval: Interval): Date {
  const seconds = INTERVAL_SECONDS[interval]
  const ms = timestamp.getTime()
  const aligned = Math.floor(ms / (seconds * 1000)) * (seconds * 1000)
  return new Date(aligned)
}

/**
 * 单次 upsert 一根 K 线
 * @param chainId 链 ID
 * @param token 代币地址
 * @param interval 时间间隔
 * @param tradeTime 交易时间
 * @param price 成交价(单位:平台币 wei per 1e18 token,即 token 价格)
 * @param volumeIn 成交量(平台币 wei)
 * @param totalSupply 总供应量(用来算市值)
 */
async function upsertCandle(
  chainId: number,
  token: string,
  interval: Interval,
  tradeTime: Date,
  price: bigint,
  volumeIn: bigint,
  totalSupply: bigint
) {
  const openTime = alignToBucket(tradeTime, interval)
  const marketCap = (price * totalSupply) / BigInt(10 ** 18)

  await query(
    `INSERT INTO price_candles
       (chain_id, token_address, interval, open_time, open_price, high_price, low_price, close_price, volume, trade_count, market_cap)
     VALUES ($1, $2, $3, $4, $5, $5, $5, $5, $6, 1, $7)
     ON CONFLICT (chain_id, token_address, interval, open_time) DO UPDATE SET
       high_price = GREATEST(price_candles.high_price, $5),
       low_price = LEAST(price_candles.low_price, $5),
       close_price = $5,
       volume = price_candles.volume + $6,
       trade_count = price_candles.trade_count + 1,
       market_cap = $7`,
    [
      chainId,
      token.toLowerCase(),
      interval,
      openTime,
      price.toString(),
      volumeIn.toString(),
      marketCap.toString(),
    ]
  )
}

/**
 * 处理单笔新交易 → 更新所有 interval 的蜡烛
 */
export async function processTrade(
  chainId: number,
  token: string,
  blockTimestamp: Date,
  tokenAmount: bigint,
  currencyAmount: bigint,  // 含手续费的平台币 wei
  tokenTotalSupply: bigint
) {
  // 价格 = currencyAmount / tokenAmount(单位:platform币 wei per 1 wei token)
  if (tokenAmount === 0n) return
  const pricePerToken = (currencyAmount * BigInt(10 ** 18)) / tokenAmount

  // 一次事务性更新所有 interval
  // 🆕 PGlite 单进程内嵌,直接串行执行即可(不需要 BEGIN/COMMIT)
  try {
    for (const interval of INTERVALS) {
      await upsertCandle(
        chainId, token, interval,
        blockTimestamp, pricePerToken, currencyAmount, tokenTotalSupply
      )
    }
  } catch (err) {
    log.error({ err, token }, '蜡烛更新失败')
  }
}

/**
 * 启动后台轮询监听新交易
 * 每 5 秒检查一次 trades 表,把新交易喂给 processTrade
 */
export function startCandleListener() {
  let lastSeenId = 0n

  const tick = async () => {
    try {
// 拿比 lastSeenId 新的所有交易
    // 注意:trades 表已经存在,但 tokens.total_supply 也是 schema 新加的字段
    // LEFT JOIN 防止代币被删除时丢数据
    const rows = await query<{
      id: string
      chain_id: number
      token_address: string
      token_amount: string
      currency_amount: string
      timestamp: Date
      total_supply: string
    }>(
      `SELECT t.id, t.chain_id, t.token_address, t.token_amount, t.currency_amount, t.timestamp,
              COALESCE(tok.total_supply, $2)::text AS total_supply
       FROM trades t
       LEFT JOIN tokens tok ON tok.address = t.token_address AND tok.chain_id = t.chain_id
       WHERE t.id > $1
       ORDER BY t.id ASC
       LIMIT 200`,
      [lastSeenId.toString(), (10n ** 18n * 1000000n).toString()] // 默认 100 万代币 supply
    )

      for (const row of rows) {
        await processTrade(
          Number(row.chain_id),
          row.token_address,
          new Date(row.timestamp),
          BigInt(row.token_amount),
          BigInt(row.currency_amount),
          BigInt(row.total_supply),
        )
        lastSeenId = BigInt(row.id)
      }
    } catch (err) {
      log.error({ err }, '蜡烛轮询失败')
    }
  }

  // 立即跑一次,然后每 5 秒
  tick()
  setInterval(tick, 5_000)
  log.info('蜡烛聚合服务已启动')
}

/**
 * 查询 K 线数据(给前端)
 */
export async function getCandles(
  chainId: number,
  token: string,
  interval: Interval,
  limit = 100
) {
  return query(
    `SELECT
       open_time, open_price, high_price, low_price, close_price,
       volume, trade_count, market_cap
     FROM price_candles
     WHERE chain_id = $1 AND token_address = $2 AND interval = $3
     ORDER BY open_time DESC
     LIMIT $4`,
    [chainId, token.toLowerCase(), interval, limit]
  )
}

/**
 * 计算 24h 变动百分比
 */
export async function get24hChange(chainId: number, token: string): Promise<{
  change: number
  current: number
  previous: number
} | null> {
  const rows = await query(
    `SELECT close_price, open_time
     FROM price_candles
     WHERE chain_id = $1 AND token_address = $2 AND interval = '1m'
     ORDER BY open_time DESC
     LIMIT 1440`,
    [chainId, token.toLowerCase()]
  )

  if (rows.length < 2) return null

  const current = Number(rows[0].close_price)
  // 找到 24 小时前的价格
  const targetTime = new Date(Date.now() - 24 * 60 * 60 * 1000)
  let previous = current
  for (const row of rows.reverse()) {
    if (new Date(row.open_time).getTime() <= targetTime.getTime()) {
      previous = Number(row.close_price)
      break
    }
  }

  const change = ((current - previous) / previous) * 100
  return { change, current, previous }
}

export { INTERVALS, type Interval }
