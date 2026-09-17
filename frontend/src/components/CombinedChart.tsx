/**
 * CombinedChart - 组合图表(蜡烛 + 交易量)
 * 上半部分:蜡烛图
 * 下半部分:交易量柱状图
 * 顶部:价格摘要 + interval 切换
 */
import { useState } from 'react'
import { useCandles, useTokenStats, CandleInterval } from '../hooks/useChartData'
import CandlestickChart from './CandlestickChart'
import VolumeChart from './VolumeChart'

interface Props {
  chainId: number
  address: string
  symbol: string
  currencySymbol: string
}

const INTERVALS: { value: CandleInterval; label: string }[] = [
  { value: '1m', label: '1分' },
  { value: '5m', label: '5分' },
  { value: '15m', label: '15分' },
  { value: '1h', label: '1小时' },
  { value: '4h', label: '4小时' },
  { value: '1d', label: '1天' },
]

export default function CombinedChart({ chainId, address, symbol, currencySymbol }: Props) {
  const [interval, setInterval] = useState<CandleInterval>('5m')
  const { data: candles = [], isLoading } = useCandles(chainId, address, interval)
  const { data: stats } = useTokenStats(chainId, address)

  if (isLoading) {
    return (
      <div className="banana-card p-6 h-96 flex items-center justify-center">
        <div className="text-gray-500 text-center">
          <div className="text-3xl mb-2 animate-bounce">📊</div>
          <p>加载图表中...</p>
        </div>
      </div>
    )
  }

  if (candles.length === 0) {
    return (
      <div className="banana-card p-6 h-96 flex items-center justify-center">
        <div className="text-gray-500 text-center">
          <div className="text-6xl mb-3">📈</div>
          <p className="text-lg">还没有交易数据</p>
          <p className="text-xs mt-2">开始交易后蜡烛和交易量图就会出现</p>
        </div>
      </div>
    )
  }

  return (
    <div className="banana-card p-5 space-y-4">
      {/* 顶部控制条 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide">
            {symbol} / {currencySymbol} K线
          </h2>
          {/* 价格由 CandlestickChart 显示 */}
        </div>

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

      {/* K 线主图 */}
      <CandlestickChart
        candles={candles}
        interval={interval}
        currencySymbol={currencySymbol}
        height={300}
      />

      {/* 交易量副图 */}
      <div>
        <h3 className="text-xs text-gray-500 mb-1 uppercase tracking-wide">📊 交易量</h3>
        <VolumeChart candles={candles} interval={interval} currencySymbol={currencySymbol} height={80} />
      </div>

      {/* 底部统计 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center pt-3 border-t border-white/5">
        <Stat label="24h 交易" value={stats?.trades24h ?? 0} />
        <Stat label="24h 交易量" value={formatVolume(stats?.volume24h)} suffix={currencySymbol} />
        <Stat label="总交易数" value={stats?.tradesAll ?? 0} />
        <Stat label="总交易量" value={formatVolume(stats?.volumeAll)} suffix={currencySymbol} />
      </div>
    </div>
  )
}

function Stat({ label, value, suffix }: { label: string; value: string | number; suffix?: string }) {
  return (
    <div className="p-2">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-bold text-white">
        {value}
        {suffix && <span className="text-xs text-gray-500 ml-1">{suffix}</span>}
      </div>
    </div>
  )
}

function formatVolume(vol: string | undefined): string {
  if (!vol) return '0'
  const n = Number(BigInt(vol) / BigInt(10 ** 14)) / 10000
  if (n >= 1000) return (n / 1000).toFixed(2) + 'K'
  if (n >= 1) return n.toFixed(2)
  return n.toFixed(4)
}
