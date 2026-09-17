/**
 * TokenRow - 排行榜单行
 * 高级玻璃 + 排名 + Sparkline + 涨跌
 */
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import MiniSparkline from './MiniSparkline'
import { StatusPill, StatBadge } from './UI'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface Entry {
  rank: number
  address: string
  chainId: number
  chainName: string
  name: string
  symbol: string
  label: number
  imageUrl: string | null
  creatorAddress: string
  createdAt: string
  graduatedAt: string | null
  currentReserve: string
  totalSupply: string
  lockPeriod: number
  volume24h: string
  trades24h: number
  score: number | null
  change24h: number | null
  progressPercent: number | null
  tokensCount: number
}

interface Props {
  entry: Entry
  highlight?: 'hot' | 'new' | 'graduating' | 'creators' | null
  showSparkline?: boolean
}

const LABEL_NAMES: Record<number, string> = {
  0: 'MEME', 1: 'AI', 2: 'DeFi', 3: 'GameFi', 4: 'Social', 5: 'Infra', 6: 'Other',
}

const CHAIN_BADGE: Record<number, { label: string; color: string }> = {
  97:         { label: 'BSC',       color: '#fcd34d' },
  11155111:   { label: 'ETH',       color: '#7dd3fc' },
  46630:      { label: 'Robinhood', color: '#34d399' },
  5042002:    { label: 'Arc',       color: '#67e8f9' },
}

const LOCK_LABELS = ['⚠️无锁仓', '🔒1天', '🔒7天', '🔒30天', '🔒1年', '🔥永久销毁']

export default function TokenRow({ entry, highlight, showSparkline = true }: Props) {
  const { data: sparkline } = useQuery<number[]>({
    queryKey: ['sparkline', entry.chainId, entry.address],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/leaderboard/sparkline/${entry.chainId}/${entry.address}?points=24`)
      if (!res.ok) return []
      const data = await res.json()
      return (data.data ?? []) as number[]
    },
    enabled: showSparkline && Boolean(entry.address) && entry.address.length === 42,
    staleTime: 60_000,
  })

  const isUp = (entry.change24h ?? 0) >= 0
  const rankBadge = entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : `#${entry.rank}`
  const chainBadge = CHAIN_BADGE[entry.chainId] || { label: `C${entry.chainId}`, color: '#94a3b8' }
  const lockLabel = LOCK_LABELS[entry.lockPeriod] || LOCK_LABELS[0]

  const highlightColor = highlight === 'new' ? '#7dd3fc' :
                        highlight === 'graduating' ? '#34d399' :
                        highlight === 'hot' ? '#fb7185' : null

  return (
    <Link
      to={`/token/${entry.address}`}
      className="block glass-premium rounded-2xl p-3 sm:p-4 transition-all duration-300 ease-out-expo group relative overflow-hidden hover:scale-[1.005]"
    >
      {/* hover 辉光 */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: 'radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 0%), rgba(252, 211, 77, 0.06), transparent 40%)' }} />

      <div className="relative flex items-center gap-2 sm:gap-3">
        {/* 排名 */}
        <div className={`shrink-0 w-9 sm:w-10 text-center ${
          entry.rank <= 3 ? 'text-2xl' : 'text-sm'
        } ${entry.rank <= 3 ? '' : 'text-muted font-orbitron'}`}>
          {rankBadge}
        </div>

        {/* Logo */}
        <div className="shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-xl glass overflow-hidden flex items-center justify-center relative group-hover:scale-105 transition-transform">
          <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: 'radial-gradient(circle, rgba(252, 211, 77, 0.3), transparent 70%)' }}></div>
          <div className="relative">
            {entry.imageUrl ? (
              <img src={entry.imageUrl} alt={entry.symbol} className="w-full h-full object-cover"
                onError={(e) => (e.currentTarget.style.display = 'none')} />
            ) : (
              <span className="text-xl">🍌</span>
            )}
          </div>
        </div>

        {/* 名称 / 链 / 标签 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold truncate group-hover:text-banana transition-colors">{entry.symbol}</span>
            <span className="text-xs text-muted truncate">{entry.name}</span>
            <StatBadge color={chainBadge.color}>{chainBadge.label}</StatBadge>
          </div>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <StatusPill variant="info">{LABEL_NAMES[entry.label] || `L${entry.label}`}</StatusPill>
            <StatusPill variant={entry.lockPeriod === 5 ? 'danger' : 'warning'} className="text-[0.6rem]">
              {lockLabel}
            </StatusPill>
            {entry.graduatedAt ? (
              <StatusPill variant="success">🎓 已毕业</StatusPill>
            ) : entry.progressPercent != null ? (
              <StatusPill variant="warning">🚀 {entry.progressPercent.toFixed(0)}%</StatusPill>
            ) : entry.tokensCount ? (
              <StatusPill variant="neutral">{entry.tokensCount} 代币</StatusPill>
            ) : null}
            {highlightColor && (
              <span className="text-[0.6rem] font-bold font-mono px-1.5 py-0.5 rounded-md uppercase"
                style={{ background: `${highlightColor}15`, color: highlightColor, border: `1px solid ${highlightColor}40` }}>
                {highlight === 'new' ? 'NEW' : highlight === 'graduating' ? 'GRADUATING' : 'HOT'}
              </span>
            )}
          </div>
        </div>

        {/* Sparkline (desktop) */}
        {showSparkline && (
          <div className="hidden sm:block shrink-0 w-24 h-8">
            <MiniSparkline data={sparkline ?? []} height={32} />
          </div>
        )}

        {/* 涨跌 / 交易量 */}
        <div className="shrink-0 text-right min-w-[80px]">
          {entry.change24h != null ? (
            <div className={`text-sm font-bold ${isUp ? 'text-green-400' : 'text-red-400'}`}>
              {isUp ? '↑' : '↓'} {Math.abs(entry.change24h).toFixed(2)}%
            </div>
          ) : (
            <div className="text-xs text-muted">{formatVolume(entry.volume24h)}</div>
          )}
          <div className="text-[0.65rem] text-muted/70 mt-0.5 font-mono">
            {entry.trades24h ? `${entry.trades24h} 笔` : '—'}
          </div>
        </div>
      </div>

      {/* Sparkline 移动端 */}
      {showSparkline && (sparkline ?? []).length > 0 && (
        <div className="sm:hidden mt-2 h-8">
          <MiniSparkline data={sparkline ?? []} height={32} />
        </div>
      )}
    </Link>
  )
}

function formatVolume(v: string): string {
  if (!v) return '0'
  const n = Number(BigInt(v) / BigInt(10 ** 14)) / 10000
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toFixed(2)
}
