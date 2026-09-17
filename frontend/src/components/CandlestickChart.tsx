/**
 * CandlestickChart - 真正的蜡烛图(K线图)
 * 用自定义 Bar 实现红绿蜡烛,顶部报价
 */
import { useMemo } from 'react'
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  Line,
} from 'recharts'
import { Candle, CandleInterval } from '../hooks/useChartData'

interface Props {
  candles: Candle[]
  interval: CandleInterval
  currencySymbol: string
  height?: number
}

export default function CandlestickChart({ candles, interval, currencySymbol, height = 320 }: Props) {
  const data = useMemo(() => candles.map(c => {
    const open = Number(c.open_price)
    const close = Number(c.close_price)
    const isUp = close >= open
    // 蜡烛由 [bodyMin, bodyMax] 和 [wickLow, wickHigh] 组成
    return {
      time: new Date(c.open_time).getTime(),
      open, close, high: Number(c.high_price), low: Number(c.low_price),
      bodyMin: Math.min(open, close),
      bodyMax: Math.max(open, close),
      wickRange: [Number(c.low_price), Number(c.high_price)] as [number, number],
      isUp,
      color: isUp ? '#22c55e' : '#ef4444',
    }
  }), [candles])

  if (data.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-gray-500">
        暂无 K 线数据
      </div>
    )
  }

  const firstPrice = data[0].open
  const lastPrice = data[data.length - 1].close
  const priceChange = lastPrice - firstPrice
  const priceChangePercent = (priceChange / firstPrice) * 100
  const isUp = priceChange >= 0

  return (
    <div className="space-y-2">
      {/* 价格摘要 */}
      <div className="flex items-baseline gap-3 px-2">
        <span className={`text-3xl font-black ${isUp ? 'text-green-400' : 'text-red-400'}`}>
          {formatPrice(lastPrice)}
        </span>
        <span className="text-sm text-gray-500">{currencySymbol}</span>
        <span className={`text-sm font-bold ${isUp ? 'text-green-400' : 'text-red-400'}`}>
          {isUp ? '↑' : '↓'} {formatPrice(Math.abs(priceChange))} ({priceChangePercent.toFixed(2)}%)
        </span>
      </div>

      {/* K 线主体 */}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 50, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="time"
              tickFormatter={(t) => formatXAxis(t, interval)}
              tick={{ fill: '#6b7280', fontSize: 10 }}
              axisLine={{ stroke: '#1e1e2e' }}
              tickLine={false}
              minTickGap={32}
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
            <Tooltip content={<CandleTooltip currencySymbol={currencySymbol} />} />

            <ReferenceLine y={firstPrice} stroke="#6b7280" strokeDasharray="3 3" />

            {/* 影线:用 Line 类型画 wick */}
            <Line
              type="monotone"
              dataKey="wickRange"
              stroke="#f59e0b"
              strokeWidth={1}
              dot={false}
              connectNulls={false}
            />

            {/* 蜡烛实体:Bar */}
            <Bar dataKey="bodyMin" stackId="candle" fill="transparent">
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Bar>
            <Bar dataKey="bodyMax" stackId="candle" fill="transparent">
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function CandleTooltip({ active, payload, currencySymbol }: any) {
  if (!active || !payload || !payload[0]) return null
  const d = payload[0].payload
  const date = new Date(d.time)
  return (
    <div className="bg-dark-300 border border-white/20 rounded-lg p-3 text-xs shadow-xl">
      <div className="text-gray-400 mb-2 font-medium">
        {date.toLocaleDateString()} {date.toLocaleTimeString()}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono">
        <span className="text-gray-500">开:</span><span className="text-white">{formatPrice(d.open)}</span>
        <span className="text-gray-500">收:</span><span className={d.isUp ? 'text-green-400' : 'text-red-400'}>{formatPrice(d.close)}</span>
        <span className="text-gray-500">高:</span><span className="text-green-400">{formatPrice(d.high)}</span>
        <span className="text-gray-500">低:</span><span className="text-red-400">{formatPrice(d.low)}</span>
      </div>
      <div className="mt-2 pt-2 border-t border-white/10 text-gray-500">
        涨跌: <span className={d.isUp ? 'text-green-400' : 'text-red-400'}>
          {d.isUp ? '+' : ''}{((d.close - d.open) / d.open * 100).toFixed(2)}%
        </span>
      </div>
    </div>
  )
}

function formatXAxis(timestamp: number, interval: CandleInterval): string {
  const d = new Date(timestamp)
  if (interval === '1d') return `${d.getMonth() + 1}/${d.getDate()}`
  if (interval === '4h' || interval === '1h') return `${d.getHours()}:00`
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatPrice(p: number): string {
  if (p === 0) return '0'
  if (p >= 1) return p.toFixed(4)
  if (p >= 0.001) return p.toFixed(6)
  if (p >= 0.000001) return p.toFixed(8)
  return p.toExponential(2)
}
