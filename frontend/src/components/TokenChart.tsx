/**
 * TokenChart - 代币图表组件
 * 包含:
 *   1. 蜡烛图(OHLC)
 *   2. 价格曲线(右上角小图)
 *   3. 交易量柱状图(底部)
 *
 * 支持切换时间间隔: 1m / 5m / 15m / 1h / 4h / 1d
 */
import { useState } from 'react'
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts'
import { useCandles, useTokenStats, CandleInterval } from '../hooks/useChartData'

interface TokenChartProps {
  chainId: number
  address: string
  symbol: string
  currencySymbol: string  // 平台币符号:BNB / ETH / USDC
}

const INTERVALS: { value: CandleInterval; label: string }[] = [
  { value: '1m', label: '1m' },
  { value: '5m', label: '5m' },
  { value: '15m', label: '15m' },
  { value: '1h', label: '1h' },
  { value: '4h', label: '4h' },
  { value: '1d', label: '1d' },
]

export default function TokenChart({ chainId, address, symbol, currencySymbol }: TokenChartProps) {
  const [interval, setInterval] = useState<CandleInterval>('5m')
  const { data: candles = [], isLoading } = useCandles(chainId, address, interval)
  const { data: stats } = useTokenStats(chainId, address)

  if (isLoading) {
    return (
      <div className="banana-card p-6 h-80 flex items-center justify-center">
        <div className="text-gray-500">📊 加载图表中...</div>
      </div>
    )
  }

  if (candles.length === 0) {
    return (
      <div className="banana-card p-6 h-80 flex items-center justify-center">
        <div className="text-gray-500 text-center">
          <div className="text-3xl mb-2">📈</div>
          <p>还没有交易数据</p>
          <p className="text-xs">开始交易后图表就会出现</p>
        </div>
      </div>
    )
  }

  const change24h = stats?.change24h
  const isUp = (change24h?.change ?? 0) >= 0

  // 为蜡烛图准备数据
  const chartData = candles.map((c) => ({
    time: new Date(c.open_time).getTime(),
    open: Number(c.open_price),
    high: Number(c.high_price),
    low: Number(c.low_price),
    close: Number(c.close_price),
    volume: Number(BigInt(c.volume) / BigInt(10 ** 14)) / 10000, // wei → ether 简化
    isUp: Number(c.close_price) >= Number(c.open_price),
  }))

  const firstPrice = chartData[0]?.open ?? 0
  const lastPrice = chartData[chartData.length - 1]?.close ?? 0
  const high = Math.max(...chartData.map(d => d.high))
  const low = Math.min(...chartData.map(d => d.low))

  return (
    <div className="banana-card p-5 space-y-4">
      {/* 顶部:价格信息 + interval 切换 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-black text-white">
              {formatPrice(lastPrice)} {currencySymbol}
            </span>
            {change24h && (
              <span className={`text-sm font-bold ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                {isUp ? '↗' : '↘'} {change24h.change.toFixed(2)}%
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 mt-1 space-x-3">
            <span>最高: {formatPrice(high)}</span>
            <span>最低: {formatPrice(low)}</span>
            <span>交易量(24h): {formatVolume(stats?.volume24h)}</span>
          </div>
        </div>

        {/* interval 切换 */}
        <div className="flex gap-1 bg-dark-200 rounded-xl p-1">
          {INTERVALS.map(i => (
            <button
              key={i.value}
              onClick={() => setInterval(i.value)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                interval === i.value
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {i.label}
            </button>
          ))}
        </div>
      </div>

      {/* 主图:价格 */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="time"
              tickFormatter={(t) => formatTime(t, interval)}
              tick={{ fill: '#6b7280', fontSize: 10 }}
              axisLine={{ stroke: '#1e1e2e' }}
              tickLine={false}
            />
            <YAxis
              domain={['auto', 'auto']}
              tickFormatter={(v) => formatPrice(v)}
              tick={{ fill: '#6b7280', fontSize: 10 }}
              axisLine={{ stroke: '#1e1e2e' }}
              tickLine={false}
              width={60}
              orientation="right"
            />
            <Tooltip content={<CustomTooltip currencySymbol={currencySymbol} />} />
            <ReferenceLine y={firstPrice} stroke="#6b7280" strokeDasharray="3 3" />
            <Line
              type="monotone"
              dataKey="close"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 副图:交易量 */}
      <div className="h-24 border-t border-white/5 pt-3">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="time"
              tickFormatter={(t) => formatTime(t, interval)}
              tick={{ fill: '#6b7280', fontSize: 10 }}
              axisLine={{ stroke: '#1e1e2e' }}
              tickLine={false}
            />
            <YAxis hide />
            <Tooltip content={<VolumeTooltip currencySymbol={currencySymbol} />} />
            <Bar dataKey="volume" maxBarSize={4}>
              {chartData.map((entry, index) => (
                <Cell key={index} fill={entry.isUp ? '#22c55e' : '#ef4444'} fillOpacity={0.6} />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 统计 */}
      <div className="grid grid-cols-4 gap-2 text-center text-xs pt-3 border-t border-white/5">
        <div>
          <div className="text-gray-500">24h 交易</div>
          <div className="font-bold text-white">{stats?.trades24h ?? 0}</div>
        </div>
        <div>
          <div className="text-gray-500">24h 交易量</div>
          <div className="font-bold text-white">{formatVolume(stats?.volume24h)}</div>
        </div>
        <div>
          <div className="text-gray-500">总交易数</div>
          <div className="font-bold text-white">{stats?.tradesAll ?? 0}</div>
        </div>
        <div>
          <div className="text-gray-500">总交易量</div>
          <div className="font-bold text-white">{formatVolume(stats?.volumeAll)}</div>
        </div>
      </div>
    </div>
  )
}

// ============= 自定义 Tooltip =============

function CustomTooltip({ active, payload, currencySymbol }: any) {
  if (!active || !payload || !payload[0]) return null
  const d = payload[0].payload
  return (
    <div className="bg-dark-200 border border-white/10 rounded-lg p-2 text-xs shadow-lg">
      <div className="text-gray-400 mb-1">{new Date(d.time).toLocaleString()}</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
        <span className="text-gray-500">开:</span><span className="text-white font-mono">{formatPrice(d.open)}</span>
        <span className="text-gray-500">高:</span><span className="text-green-400 font-mono">{formatPrice(d.high)}</span>
        <span className="text-gray-500">低:</span><span className="text-red-400 font-mono">{formatPrice(d.low)}</span>
        <span className="text-gray-500">收:</span><span className="text-yellow-400 font-mono font-bold">{formatPrice(d.close)}</span>
      </div>
    </div>
  )
}

function VolumeTooltip({ active, payload, currencySymbol }: any) {
  if (!active || !payload || !payload[0]) return null
  const d = payload[0].payload
  return (
    <div className="bg-dark-200 border border-white/10 rounded-lg p-2 text-xs">
      <div className="text-gray-400">{new Date(d.time).toLocaleString()}</div>
      <div className="text-white">
        交易量: <span className="font-bold">{d.volume.toFixed(2)}</span> {currencySymbol}
      </div>
    </div>
  )
}

// ============= 格式化工具 =============

function formatPrice(price: number): string {
  if (price >= 1) return price.toFixed(4)
  if (price >= 0.001) return price.toFixed(6)
  if (price >= 0.000001) return price.toFixed(8)
  return price.toExponential(2)
}

function formatVolume(vol: string | undefined): string {
  if (!vol) return '0'
  const n = Number(BigInt(vol) / BigInt(10 ** 14)) / 10000
  if (n >= 1000) return (n / 1000).toFixed(2) + 'K'
  if (n >= 1) return n.toFixed(2)
  return n.toFixed(4)
}

function formatTime(timestamp: number, interval: CandleInterval): string {
  const d = new Date(timestamp)
  if (interval === '1d') {
    return `${d.getMonth() + 1}/${d.getDate()}`
  }
  if (interval === '4h' || interval === '1h') {
    return `${d.getHours()}:00 ${d.getMonth() + 1}/${d.getDate()}`
  }
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}
