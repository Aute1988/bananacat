import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useWallet } from '../hooks/useWallet'
import { LOCK_PERIOD_LABELS } from '../chains/config'
import {
  PageHero, Section, EmptyState, StatusPill, ConnectingState, StatBadge, CompactCard, InfoBadge
} from '../components/UI'

const MOCK_MY_TOKENS = [
  {
    address: '0x1234567890abcdef1234567890abcdef12345678',
    name: 'Bitcoin Cat',
    symbol: 'BCAT',
    lockPeriod: 4,
    graduated: false,
    progress: 67.5,
    currencyReserve: '16.2',
    lockStatus: 'locked',
    unlockTime: '2025-09-23 12:00',
    daysLeft: 7,
    hoursLeft: 14,
    lockId: '0xaaa...111',
  },
  {
    address: '0x2234567890abcdef1234567890abcdef22345678',
    name: 'Doge King',
    symbol: 'DOGK',
    lockPeriod: 5,
    graduated: true,
    progress: 100,
    currencyReserve: '24.0',
    lockStatus: 'burned',
    lockId: '0xbbb...222',
  },
  {
    address: '0x3234567890abcdef1234567890abcdef32345678',
    name: 'Pepe Gold',
    symbol: 'PEPEG',
    lockPeriod: 2,
    graduated: false,
    progress: 100,
    currencyReserve: '24.0',
    lockStatus: 'claimable',
    unlockTime: '2025-09-10 12:00',
    daysLeft: 0,
    hoursLeft: 0,
    lockId: '0xccc...333',
  },
]

const LOCK_STATUS_CONFIG = {
  locked:    { label: '🔒 锁仓中',  variant: 'warning' as const, canClaim: false },
  claimable: { label: '✅ 可领取',  variant: 'success' as const, canClaim: true },
  burned:    { label: '🔥 已销毁',  variant: 'danger'  as const, canClaim: false },
  none:      { label: '⚠️ 无锁仓',  variant: 'neutral' as const, canClaim: false },
}

export default function MyTokensPage() {
  const { address, connect } = useWallet()
  const [filter, setFilter] = useState<'all' | 'claimable' | 'locked'>('all')

  if (!address) {
    return (
      <ConnectingState
        emoji="👤"
        title="连接钱包查看我的代币"
        desc="连接后显示你创建的所有代币和锁仓状态"
        onConnect={connect}
      />
    )
  }

  const filtered = MOCK_MY_TOKENS.filter(token => {
    if (filter === 'claimable') return token.lockStatus === 'claimable'
    if (filter === 'locked') return token.lockStatus === 'locked'
    return true
  })

  const claimableCount = MOCK_MY_TOKENS.filter(t => t.lockStatus === 'claimable').length
  const lockedCount    = MOCK_MY_TOKENS.filter(t => t.lockStatus === 'locked').length
  const burnedCount    = MOCK_MY_TOKENS.filter(t => t.lockStatus === 'burned').length

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageHero
        icon="👤"
        title={<>我的<span className="text-gradient-banana">代币</span></>}
        subtitle={`钱包: ${address.slice(0, 6)}...${address.slice(-4)}`}
        badge={<StatBadge color="#fcd34d">WALLET</StatBadge>}
      />

      {/* 统计 */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <CompactCard glow>
          <div className="text-center">
            <div className="text-3xl sm:text-4xl font-black font-orbitron text-gradient-banana">
              {MOCK_MY_TOKENS.length}
            </div>
            <div className="text-xs text-muted mt-2 uppercase tracking-widest">总代币数</div>
          </div>
        </CompactCard>
        <CompactCard className="cursor-pointer hover:shadow-glow-banana-sm" glow>
          <div className="text-center">
            <div className="text-3xl sm:text-4xl font-black font-orbitron text-green-400">
              {claimableCount}
            </div>
            <div className="text-xs text-muted mt-2 uppercase tracking-widest">可领取 LP</div>
            {claimableCount > 0 && (
              <StatusPill variant="success" pulse className="mt-2 text-[0.6rem]">快去领！</StatusPill>
            )}
          </div>
        </CompactCard>
        <CompactCard>
          <div className="text-center">
            <div className="text-3xl sm:text-4xl font-black font-orbitron text-gradient-cosmic">
              {burnedCount}
            </div>
            <div className="text-xs text-muted mt-2 uppercase tracking-widest">永久销毁 LP</div>
          </div>
        </CompactCard>
      </div>

      {/* 筛选 */}
      <div className="glass rounded-2xl p-2 flex gap-2 overflow-x-auto scrollbar-hide">
        {[
          { key: 'all', label: `📋 全部 (${MOCK_MY_TOKENS.length})` },
          { key: 'claimable', label: `✅ 可领取 (${claimableCount})` },
          { key: 'locked', label: `🔒 锁仓中 (${lockedCount})` },
        ].map(item => {
          const active = filter === item.key
          return (
            <button
              key={item.key}
              onClick={() => setFilter(item.key as typeof filter)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-300 ease-out-expo ${
                active ? 'scale-[1.02]' : 'hover:bg-white/5'
              }`}
              style={
                active
                  ? {
                      background: 'linear-gradient(135deg, rgba(252, 211, 77, 0.18), rgba(244, 114, 182, 0.10))',
                      border: '1px solid rgba(252, 211, 77, 0.4)',
                      boxShadow: '0 0 20px rgba(252, 211, 77, 0.18)',
                      color: '#fcd34d',
                    }
                  : { border: '1px solid transparent', color: '#7d83a3' }
              }
            >
              {item.label}
            </button>
          )
        })}
      </div>

      {/* 代币列表 */}
      {filtered.length === 0 ? (
        <EmptyState
          emoji="📭"
          title="暂无符合条件的代币"
          desc={filter === 'claimable' ? '目前没有可领取的锁仓 LP' : '还没有创建代币,去发一个试试'}
          action={{ label: '🍌 立即发币', onClick: () => window.location.href = '/create' }}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((token, i) => {
            const statusCfg = LOCK_STATUS_CONFIG[token.lockStatus as keyof typeof LOCK_STATUS_CONFIG]
            return (
              <CompactCard
                key={token.address}
                className="animate-slide-up"
              >
                <div className="flex items-start gap-4">
                  {/* Logo */}
                  <div className="relative shrink-0">
                    <div className="absolute inset-0 rounded-2xl blur-md opacity-60"
                      style={{ background: 'radial-gradient(circle, rgba(252, 211, 77, 0.4), transparent 70%)' }}></div>
                    <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
                      style={{
                        background: 'linear-gradient(135deg, rgba(252, 211, 77, 0.18), rgba(244, 114, 182, 0.1))',
                        border: '1px solid rgba(252, 211, 77, 0.35)',
                      }}>
                      🐱
                    </div>
                  </div>

                  {/* 信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display font-bold text-lg tracking-tight">{token.name}</span>
                      <span className="text-muted text-sm font-mono">{token.symbol}</span>
                      {token.graduated
                        ? <StatusPill variant="success">🎓 已毕业</StatusPill>
                        : <StatusPill variant="warning">📈 交易中</StatusPill>}
                      <StatusPill variant={statusCfg.variant}>{statusCfg.label}</StatusPill>
                    </div>

                    {/* 锁仓详情 */}
                    <div className="mt-3 space-y-2.5 glass rounded-xl p-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted">锁仓期限</span>
                        <span className="text-banana font-bold">{LOCK_PERIOD_LABELS[token.lockPeriod]}</span>
                      </div>

                      {token.lockStatus === 'burned' && (
                        <InfoBadge type="danger" icon="💀">
                          LP 已永久销毁,包括你在内任何人都无法提取。这是对买家最强的信任承诺！
                        </InfoBadge>
                      )}
                      {token.lockStatus === 'claimable' && (
                        <InfoBadge type="success" icon="✅">
                          <span className="font-bold">锁仓已到期!</span>
                          <span className="text-secondary ml-2">可三选一: 🟢 提取 · 🔄 续锁 · 🔥 销毁</span>
                        </InfoBadge>
                      )}
                      {token.lockStatus === 'locked' && (
                        <InfoBadge type="warning" icon="🔒">
                          还有 <span className="font-mono font-bold">{token.daysLeft} 天 {token.hoursLeft} 小时</span> 解锁
                        </InfoBadge>
                      )}

                      <div className="flex justify-between text-sm">
                        <span className="text-muted">积累资金</span>
                        <span className="font-bold font-mono">{token.currencyReserve} BNB</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted">Lock ID</span>
                        <span className="text-muted font-mono text-xs">{token.lockId}</span>
                      </div>
                    </div>
                  </div>

                  {/* 操作 */}
                  <div className="flex flex-col gap-2 shrink-0">
                    <Link
                      to={`/token/${token.address}`}
                      className="btn-glass text-sm px-4 py-2 text-center whitespace-nowrap"
                    >
                      查看详情
                    </Link>
                    {token.lockStatus === 'claimable' && (
                      <Link
                        to={`/unlock/${token.lockId}`}
                        className="btn-banana text-sm px-4 py-2 text-center whitespace-nowrap"
                      >
                        🎉 三选一
                      </Link>
                    )}
                    {token.lockStatus === 'locked' && (
                      <Link
                        to={`/unlock/${token.lockId}`}
                        className="btn-cat text-sm px-4 py-2 text-center whitespace-nowrap"
                      >
                        查看锁仓
                      </Link>
                    )}
                  </div>
                </div>
              </CompactCard>
            )
          })}
        </div>
      )}

      {/* 销毁统计 */}
      {burnedCount > 0 && (
        <InfoBadge type="danger" icon="🔥">
          你有 <span className="font-bold mx-1">{burnedCount}</span>
          个代币选择了永久销毁 LP,这些流动性已被彻底抹去 — 这是你对买家的最强信任承诺！
        </InfoBadge>
      )}
    </div>
  )
}
