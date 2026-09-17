/**
 * VolumeChart - 交易量柱状图
 * 红涨绿跌(中文市场习惯) - 跟着价格涨跌变颜色
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
} from 'recharts'
import { Candle, CandleInterval } from '../hooks/useChartData'

interface Props {
  candles: Candle[]
  interval: CandleInterval
  currencySymbol: string
  height?: number
}

export default function VolumeChart({ candles, interval, currencySymbol, height = 80 }: Props) {
  const data = useMemo(() => candles.map(c => {
    const open = Number(c.open_price)
    const close = Number(c.close_price)
    return {
      time: new Date(c.open_time).getTime(),
      volume: Number(BigInt(c.volume) / BigInt(10 ** 14)) / 10000,
      isUp: close >= open,
    }
  }), [candles])

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 5, right: 50, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="time"
            tickFormatter={(t) => formatXAxis(t, interval)}
            tick={{ fill: '#6b7280', fontSize: 10 }}
            axisLine={{ stroke: '#1e1e2e' }}
            tickLine={false}
            minTickGap={32}
          />
          <YAxis hide />
          <Tooltip content={<VolumeTooltip currencySymbol={currencySymbol} />} />
          <Bar dataKey="volume" maxBarSize={3}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.isUp ? '#22c55e' : '#ef4444'} fillOpacity={0.5} />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

function VolumeTooltip({ active, payload, currencySymbol }: any) {
  if (!active || !payload || !payload[0]) return null
  const d = payload[0].payload
  return (
    <div className="bg-dark-300 border border-white/20 rounded-lg p-2 text-xs">
      <div className="text-gray-400">{new Date(d.time).toLocaleString()}</div>
      <div className="text-white">
        交易量: <span className="font-bold">{d.volume.toFixed(2)} {currencySymbol}</span>
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
