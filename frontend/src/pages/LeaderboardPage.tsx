/**
 * LeaderboardPage - 排行榜页面
 * 7 个维度:综合热门 / 24h 交易量 / 24h 涨幅 / 最新创建 / 即将毕业 / 趋势 / 顶级发币者
 *
 * 布局:
 *   - 顶部 PageHero + 实时刷新状态
 *   - Tab 切换器(玻璃态 + 金色渐变)
 *   - Podium 领奖台(前3名)
 *   - TokenRow 列表
 *   - 顶级发币者特殊展示
 */
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import TokenRow from '../components/TokenRow'
import { PageHero, EmptyState, StatusPill, StatBadge, SkeletonCard } from '../components/UI'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

type Tab = 'hot' | 'volume_24h' | 'gainers' | 'new' | 'graduating' | 'trending' | 'creators'

const TABS: { value: Tab; label: string; emoji: string; desc: string }[] = [
  { value: 'hot',         label: '综合热门', emoji: '🔥', desc: '基于交易量、交易笔数综合得分' },
  { value: 'volume_24h',  label: '24h 交易量', emoji: '💰', desc: '过去 24 小时成交的代币金额' },
  { value: 'gainers',     label: '24h 涨幅', emoji: '📈', desc: '价格涨幅排行(越多越绿)' },
  { value: 'trending',    label: '7 天趋势', emoji: '⚡', desc: '交易频率上升最快的代币' },
  { value: 'new',         label: '最新创建', emoji: '🆕', desc: '刚发出来的代币' },
  { value: 'graduating',  label: '即将毕业', emoji: '🚀', desc: '联合曲线进度 ≥ 80%' },
  { value: 'creators',    label: '顶级发币者', emoji: '🏆', desc: '按发币数量排序的创建者' },
]

// ============================================================
// 主组件
// ============================================================
export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>('hot')
  const [limit] = useState(50)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['leaderboard', activeTab, limit],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/leaderboard?type=${activeTab}&limit=${limit}`)
      if (!res.ok) throw new Error((await res.json()).error || '加载失败')
      return res.json() as Promise<{
        type: Tab
        entries: any[]
        updatedAt: string
      }>
    },
    refetchInterval: 60_000, // 1 分钟刷新
    staleTime: 30_000,
  })

  const currentTab = useMemo(() => TABS.find(t => t.value === activeTab)!, [activeTab])

  // 刷新状态指示器
  const RefreshIndicator = () => (
    <div className="flex items-center gap-2">
      <div className="relative w-2 h-2">
        <div className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-75"></div>
        <div className="absolute inset-0 rounded-full bg-green-400"></div>
      </div>
      <span className="text-xs text-muted font-mono">每 60s 刷新</span>
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* 1. PageHero 顶部 */}
      <PageHero
        icon="🏆"
        title="Launchpad 排行榜"
        subtitle="看看哪个代币最火 · 每 60 秒自动刷新 ⏱️"
        variant="gold"
        backLink={{ label: '回到首页', to: '/' }}
        actions={<RefreshIndicator />}
      />

      {/* 2. Tab 切换器 - 玻璃态 + 金色渐变 */}
      <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="glass-premium rounded-2xl p-2 inline-flex gap-1 min-w-max sm:flex-wrap sm:inline-flex sm:justify-center">
          {TABS.map(tab => (
            <TabButton
              key={tab.value}
              tab={tab}
              isActive={activeTab === tab.value}
              onClick={() => setActiveTab(tab.value)}
            />
          ))}
        </div>
      </div>

      {/* 3. 当前 Tab 描述区 */}
      <div className="glass rounded-xl px-4 py-2.5 flex items-center justify-between gap-4 animate-fade-in">
        <div className="flex items-center gap-2">
          <span className="text-lg">{currentTab.emoji}</span>
          <span className="text-sm text-secondary">{currentTab.desc}</span>
        </div>
        {data?.updatedAt && (
          <div className="flex items-center gap-2 text-xs text-muted font-mono shrink-0">
            <span>🕐</span>
            <span>更新于 {formatTime(data.updatedAt)}</span>
          </div>
        )}
      </div>

      {/* 4. 错误状态 */}
      {isError && (
        <div className="glass-premium rounded-2xl p-8 text-center animate-fade-in">
          <div className="text-5xl mb-3">🚨</div>
          <p className="text-red-400 font-medium">{(error as Error).message}</p>
        </div>
      )}

      {/* 5. 加载状态 */}
      {isLoading && <SkeletonCard variant="row" rows={5} />}

      {/* 6. 空状态 */}
      {data && data.entries.length === 0 && (
        <EmptyState
          emoji="🌀"
          title="暂无数据"
          desc="有更多交易后这里会展示出来。快去创建一个代币吧!"
          action={{ label: '🍌 立即发币', onClick: () => window.location.href = '/create' }}
        />
      )}

      {/* 7. 数据列表 */}
      {data && data.entries.length > 0 && (
        <>
          {/* 前 3 名 Podium 领奖台 */}
          {data.entries.length >= 3 && activeTab !== 'creators' && (
            <div className="grid grid-cols-3 gap-4 sm:gap-6 mb-6">
              {/* 🥈 亚军 - 左侧 */}
              <PodiumCard
                entry={data.entries[1]}
                rank={2}
                medal="🥈"
                gradient="from-gray-300/20 to-gray-400/10"
                borderColor="rgba(192,192,192,0.4)"
              />

              {/* 🥇 冠军 - 中间(突出) */}
              <PodiumCard
                entry={data.entries[0]}
                rank={1}
                medal="🥇"
                gradient="from-yellow-500/25 to-orange-500/15"
                borderColor="rgba(252,211,77,0.6)"
                isChampion
              />

              {/* 🥉 季军 - 右侧 */}
              <PodiumCard
                entry={data.entries[2]}
                rank={3}
                medal="🥉"
                gradient="from-orange-700/20 to-yellow-700/10"
                borderColor="rgba(205,127,50,0.4)"
              />
            </div>
          )}

          {/* 剩余列表 */}
          <div className="space-y-3">
            {data.entries
              .filter(e => activeTab === 'creators' || e.rank > 3)
              .slice(0, activeTab === 'creators' ? 0 : undefined)
              .map((entry: any) => (
                <TokenRow
                  key={`${entry.chainId}-${entry.address}`}
                  entry={entry}
                  highlight={activeTab === 'new' ? 'new' : activeTab === 'graduating' ? 'graduating' : null}
                />
              ))}

            {/* 顶级发币者特殊展示 */}
            {activeTab === 'creators' && data.entries.map((e: any) => (
              <CreatorRow key={e.address} entry={e} />
            ))}
          </div>
        </>
      )}

      {/* 底部提示 */}
      <div className="text-center text-xs text-muted pt-4 font-mono">
        <span className="inline-flex items-center gap-1">
          <span>📊</span>
          <span>
            数据每 60 秒自动刷新 · 基于 {
              activeTab === 'hot' ? '综合得分' :
              activeTab === 'volume_24h' ? '24h 交易量' :
              activeTab === 'gainers' ? '价格变动' :
              activeTab === 'trending' ? '交易频率增长' :
              activeTab === 'new' ? '创建时间' :
              activeTab === 'graduating' ? '曲线进度' :
              '发币数量'
            } 排序
          </span>
        </span>
      </div>
    </div>
  )
}

// ============================================================
// Tab 按钮组件
// ============================================================
function TabButton({ tab, isActive, onClick }: { tab: typeof TABS[0]; isActive: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`
        relative px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap
        transition-all duration-300 ease-out-expo flex items-center gap-2
        ${isActive
          ? 'bg-gradient-to-r from-yellow-500/30 via-yellow-500/20 to-orange-500/20 text-yellow-400 border border-yellow-500/40 shadow-lg shadow-yellow-500/10'
          : 'text-gray-400 hover:text-white hover:border-white/20 border border-transparent'
        }
      `}
    >
      {/* Active 顶部高光线 */}
      {isActive && (
        <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-yellow-400/60 to-transparent"></div>
      )}
      <span className="text-base">{tab.emoji}</span>
      <span>{tab.label}</span>
    </button>
  )
}

// ============================================================
// 前 3 名 Podium 领奖台
// ============================================================
interface PodiumCardProps {
  entry: any
  rank: number
  medal: string
  gradient: string
  borderColor: string
  isChampion?: boolean
}

function PodiumCard({ entry, rank, medal, gradient, borderColor, isChampion = false }: PodiumCardProps) {
  const isUp = (entry.change24h ?? 0) >= 0

  return (
    <Link
      to={`/token/${entry.address}`}
      className={`
        block relative rounded-2xl p-4 transition-all duration-500 ease-out-expo
        hover:scale-105 group
        ${isChampion ? 'scale-110 z-10' : 'sm:scale-95 sm:hover:scale-100'}
      `}
      style={{
        background: `linear-gradient(135deg, ${gradient.replace('/20', '/15').replace('/10', '/08')})`,
        border: `1px solid ${borderColor}`,
        boxShadow: isChampion
          ? `0 0 40px rgba(252, 211, 77, 0.3), 0 0 80px rgba(252, 211, 77, 0.15), inset 0 1px 0 rgba(255,255,255,0.1)`
          : `0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.06)`,
      }}
    >
      {/* 顶部高光线 */}
      <div className="absolute top-0 left-10 right-10 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>

      {/* 冠军辉光动画 */}
      {isChampion && (
        <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-orange-500/10 blur-xl opacity-50 animate-pulse"></div>
      )}

      <div className="relative">
        {/* 排名 + 奖牌 */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-3xl sm:text-4xl">{medal}</span>
          <StatusPill variant={isChampion ? 'glow' : 'neutral'} className="font-mono">
            #{rank}
          </StatusPill>
        </div>

        {/* 头像 */}
        <div className="flex justify-center mb-3">
          <div
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center overflow-hidden border-2 transition-transform group-hover:scale-110"
            style={{
              background: isChampion
                ? 'linear-gradient(135deg, rgba(252, 211, 77, 0.3), rgba(244, 114, 182, 0.2))'
                : 'rgba(255,255,255,0.05)',
              borderColor: borderColor,
              boxShadow: isChampion ? `0 0 20px rgba(252, 211, 77, 0.3)` : 'none',
            }}
          >
            {entry.imageUrl ? (
              <img src={entry.imageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl sm:text-3xl">🍌</span>
            )}
          </div>
        </div>

        {/* 名称符号 */}
        <div className="text-center mb-2">
          <div className="font-display font-black text-base sm:text-lg text-white truncate">
            {entry.symbol}
          </div>
          <div className="text-xs text-muted truncate">{entry.name}</div>
        </div>

        {/* 涨跌 / 交易量 */}
        <div className="text-center pt-2 border-t border-white/5">
          {entry.change24h != null ? (
            <div className={`text-sm font-bold ${isUp ? 'text-green-400' : 'text-red-400'}`}>
              {isUp ? '↑' : '↓'} {Math.abs(entry.change24h).toFixed(2)}%
            </div>
          ) : (
            <div className="text-sm font-mono text-secondary">
              {formatVolume(entry.volume24h)}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

// ============================================================
// 顶级发币者特殊展示
// ============================================================
function CreatorRow({ entry }: { entry: any }) {
  const rankDisplay = entry.rank <= 3
    ? ['🥇', '🥈', '🥉'][entry.rank - 1]
    : `#${entry.rank}`

  return (
    <Link
      to={`/my-tokens`}
      className="block glass-premium rounded-2xl p-4 hover:border-yellow-500/40 transition-all duration-300 ease-out-expo group"
    >
      <div className="flex items-center gap-4">
        {/* 排名 */}
        <div className="flex-shrink-0 w-12 text-center">
          <span className="text-2xl sm:text-3xl">{rankDisplay}</span>
        </div>

        {/* 头像渐变 */}
        <div
          className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold text-dark-100 transition-transform group-hover:scale-110"
          style={{
            background: 'linear-gradient(135deg, #fcd34d, #f59e0b, #ea580c)',
            boxShadow: '0 4px 16px rgba(252, 211, 77, 0.3)',
          }}
        >
          {entry.creatorAddress.slice(2, 4).toUpperCase()}
        </div>

        {/* 地址 */}
        <div className="flex-1 min-w-0">
          <div className="font-mono text-sm text-white truncate">
            {entry.creatorAddress.slice(0, 6)}...{entry.creatorAddress.slice(-4)}
          </div>
          <div className="text-xs text-muted mt-0.5">
            已发 <span className="text-yellow-400 font-bold">{entry.tokensCount}</span> 个代币
          </div>
        </div>

        {/* Token 数量 */}
        <div className="flex-shrink-0 text-right">
          <StatBadge color="#fcd34d">
            {entry.tokensCount} 个
          </StatBadge>
        </div>
      </div>
    </Link>
  )
}

// ============================================================
// 工具函数
// ============================================================
function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatVolume(v: string): string {
  if (!v) return '0'
  const n = Number(BigInt(v) / BigInt(10 ** 14)) / 10000
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toFixed(2)
}
