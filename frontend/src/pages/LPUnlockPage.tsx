import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useWallet } from '../hooks/useWallet'
import { useWalletClient } from 'wagmi'
import { LOCK_PERIOD_OPTIONS, CHAINS } from '../chains/config'
import { lpActionOnChain } from '../lib/contracts'
import {
  PageHero, Section, EmptyState, ConnectingState, StatusPill, KeyValue, StatBadge, InfoBadge, OptionGrid, toast,
} from '../components/UI'

interface LPLockDetail {
  lockId: string
  token: {
    address: string
    name: string
    symbol: string
    imageUrl: string
    chainId: number
    chainKey: keyof typeof CHAINS
  }
  creator: string
  lpAmount: string
  lpTokenSymbol: string
  period: number
  periodLabel: string
  unlockTimestamp: number
  claimed: boolean
  isPermanent: boolean
  canClaim: boolean
  canExtend: boolean
  canBurn: boolean
  graduated: boolean
  lockerAddress: string
  lpTokenAddress: string
}

export default function LPUnlockPage() {
  const { lockId } = useParams<{ lockId: string }>()
  const { address, connect } = useWallet()
  const { data: walletClient } = useWalletClient()
  const navigate = useNavigate()

  const [mode, setMode] = useState<'select' | 'claim' | 'extend' | 'burn'>('select')
  const [newPeriod, setNewPeriod] = useState('3')
  const [lock, setLock] = useState<LPLockDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!lockId) return
    let cancelled = false
    setLoading(true)
    fetch(`${import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE || 'http://localhost:3001'}/api/locks/${lockId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled) return
        if (data?.lock) setLock(data.lock as LPLockDetail)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [lockId])

  const handleClaim = async () => {
    if (!lock || !lockId) return
    if (!walletClient) return toast('钱包未就绪', 'error')
    setIsProcessing(true)
    setError(null)
    try {
      const tx = await lpActionOnChain(walletClient, 'claim', lock.lockerAddress as `0x${string}`, lockId, 0, lock.token.chainKey)
      setTxHash(tx)
      toast(`已提取 ${lock.lpAmount} LP`, 'success')
      setTimeout(() => navigate('/my-tokens'), 2500)
    } catch (err: any) {
      setError(err.message || err.shortMessage || '提取失败')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleExtend = async () => {
    if (!lock || !lockId) return
    if (!walletClient) return toast('钱包未就绪', 'error')
    setIsProcessing(true)
    setError(null)
    try {
      const period = parseInt(newPeriod)
      const tx = await lpActionOnChain(walletClient, 'extend', lock.lockerAddress as `0x${string}`, lockId, period, lock.token.chainKey)
      setTxHash(tx)
      const periodLabel = LOCK_PERIOD_OPTIONS.find(p => p.value === newPeriod)?.label || ''
      toast(`续锁成功! 新期限: ${periodLabel}`, 'success')
      setTimeout(() => navigate('/my-tokens'), 2500)
    } catch (err: any) {
      setError(err.message || err.shortMessage || '续锁失败')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleBurn = async () => {
    if (!lock || !lockId) return
    if (!walletClient) return toast('钱包未就绪', 'error')
    if (!confirm('🔥 确认销毁 LP 吗?\n\n这是一个不可逆操作!销毁后包括你在内任何人都无法提取 LP。\n\n这是对买家最强的信任承诺。')) {
      return
    }
    setIsProcessing(true)
    setError(null)
    try {
      const tx = await lpActionOnChain(walletClient, 'burn', lock.lockerAddress as `0x${string}`, lockId, 0, lock.token.chainKey)
      setTxHash(tx)
      toast('LP 已永久销毁!', 'success')
      setTimeout(() => navigate('/my-tokens'), 2500)
    } catch (err: any) {
      setError(err.message || err.shortMessage || '销毁失败')
    } finally {
      setIsProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center animate-fade-in">
        <div className="text-6xl mb-4 animate-spin inline-block">🍌</div>
        <p className="text-muted">加载锁仓信息…</p>
      </div>
    )
  }

  if (!lock) {
    return (
      <div className="max-w-2xl mx-auto py-20">
        <EmptyState emoji="🔍" title="锁仓记录不存在或已被处理" desc="该 lockId 在链上找不到,可能已经处理完毕"
          action={{ label: '← 返回我的代币', onClick: () => navigate('/my-tokens') }}
        />
      </div>
    )
  }

  if (!address) {
    return (
      <ConnectingState
        emoji="🔐"
        title="连接钱包查看 LP 解锁状态"
        desc="连接钱包后可执行 提取 / 续锁 / 销毁 操作"
        onConnect={connect}
      />
    )
  }

  const isOwner = address?.toLowerCase() === lock.creator.toLowerCase()
  const unlockDateStr = lock.unlockTimestamp > 0
    ? new Date(lock.unlockTimestamp * 1000).toLocaleString('zh-CN')
    : '永久销毁'
  const canDoAnything = (lock.canClaim || lock.canExtend || lock.canBurn) && isOwner && !txHash

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* 面包屑 */}
      <nav className="flex items-center gap-2 text-xs text-muted">
        <Link to="/my-tokens" className="hover:text-banana transition-colors">我的代币</Link>
        <span>›</span>
        <span className="text-secondary">LP 解锁面板</span>
      </nav>

      <PageHero
        icon="🔓"
        title={<>LP <span className="text-gradient-banana">解锁</span>面板</>}
        subtitle={
          <>
            <span className="text-muted">Lock ID: </span>
            <span className="font-mono text-xs">{lock.lockId}</span>
          </>
        }
        badge={
          lock.isPermanent
            ? <StatusPill variant="danger">🔥 永久销毁</StatusPill>
            : lock.canClaim
              ? <StatusPill variant="success" pulse>✅ 已到期</StatusPill>
              : <StatusPill variant="warning">⏳ 锁仓中</StatusPill>
        }
        variant="gold"
      />

      {!isOwner && (
        <InfoBadge type="warning">
          ⚠️ 你不是此锁仓的创建者,无法操作此 LP
        </InfoBadge>
      )}

      {txHash && (
        <InfoBadge type="success" icon="🎉">
          <div className="space-y-1">
            <div className="font-bold">操作成功!</div>
            <div className="text-xs font-mono break-all">TX: {txHash}</div>
            <div className="text-xs text-muted">即将跳转到「我的代币」…</div>
          </div>
        </InfoBadge>
      )}

      {error && <InfoBadge type="danger" icon="❌">{error}</InfoBadge>}

      {/* 代币信息 */}
      <Section icon="📋" title="代币信息" subtitle="被锁仓 LP 对应的代币" index={0}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-muted mb-1 font-mono uppercase tracking-wider">代币名称</div>
            <div className="font-bold text-gradient-banana">{lock.token.name}</div>
          </div>
          <div>
            <div className="text-xs text-muted mb-1 font-mono uppercase tracking-wider">代币符号</div>
            <div className="font-bold text-gradient-banana">{lock.token.symbol}</div>
          </div>
          <div className="col-span-2">
            <div className="text-xs text-muted mb-1 font-mono uppercase tracking-wider">代币地址</div>
            <div className="font-mono text-sm break-all">{lock.token.address}</div>
          </div>
        </div>
      </Section>

      {/* 锁仓详情 */}
      <Section icon="🔐" title="锁仓详情" subtitle="本次锁仓的所有参数" index={1}>
        <div className="glass rounded-2xl p-4 space-y-0">
          <KeyValue label="锁仓期限" value={<span className="text-banana font-bold">{lock.periodLabel}</span>} />
          <KeyValue label="解锁时间" value={unlockDateStr} />
          <KeyValue label="LP 数量" value={<span className="font-mono font-bold">{lock.lpAmount} {lock.lpTokenSymbol}</span>} mono />
          <KeyValue label="创建者" value={<span className="font-mono text-sm">{lock.creator.slice(0, 8)}...{lock.creator.slice(-4)}</span>} mono />
          <KeyValue label="状态" value={
            lock.isPermanent ? <StatusPill variant="danger">🔥 已永久销毁</StatusPill>
            : lock.canClaim ? <StatusPill variant="success" pulse>✅ 已到期 可操作</StatusPill>
            : <StatusPill variant="warning">⏳ 锁仓中</StatusPill>
          } />
        </div>
      </Section>

      {/* 三选一操作 */}
      {canDoAnything && (
        <Section
          icon="🎯"
          title="锁仓已到期!请选择操作"
          subtitle="你有 3 个选项,可以任选其一"
          index={2}
          variant="highlight"
          badge={<StatusPill variant="success" pulse>LIVE</StatusPill>}
        >
          {mode === 'select' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {lock.canClaim && (
                <ActionButton
                  emoji="🟢" emojiBg="rgba(52, 211, 153, 0.18)" emojiBorder="rgba(52, 211, 153, 0.4)" emojiGlow="rgba(52, 211, 153, 0.4)"
                  title="提取 LP"
                  titleColor="#34d399"
                  desc={`把 ${lock.lpAmount} LP 提取到自己钱包。`}
                  onClick={() => setMode('claim')}
                />
              )}
              {lock.canExtend && (
                <ActionButton
                  emoji="🔄" emojiBg="rgba(252, 211, 77, 0.18)" emojiBorder="rgba(252, 211, 77, 0.4)" emojiGlow="rgba(252, 211, 77, 0.4)"
                  title="续锁"
                  titleColor="#fcd34d"
                  desc="重新选一个期限继续锁定 LP。"
                  onClick={() => setMode('extend')}
                />
              )}
              {lock.canBurn && (
                <ActionButton
                  emoji="🔥" emojiBg="rgba(251, 113, 133, 0.18)" emojiBorder="rgba(251, 113, 133, 0.4)" emojiGlow="rgba(251, 113, 133, 0.4)"
                  title="销毁 LP"
                  titleColor="#fb7185"
                  desc="永久烧毁 LP,谁都拿不走。"
                  onClick={() => setMode('burn')}
                />
              )}
            </div>
          )}

          {/* claim 模式 */}
          {mode === 'claim' && (
            <div className="glass rounded-2xl p-5 border-2 border-green-500/40 space-y-4 animate-slide-up" style={{ boxShadow: '0 0 40px rgba(52, 211, 153, 0.2)' }}>
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-green-400 text-lg">🟢 确认提取 LP</h4>
                <button onClick={() => setMode('select')} className="btn-glass text-xs">← 返回</button>
              </div>
              <div className="glass-strong rounded-2xl p-6 text-center">
                <div className="text-4xl font-black text-gradient-banana">{lock.lpAmount}</div>
                <div className="text-sm text-muted mt-2 font-mono">{lock.lpTokenSymbol} (PancakeSwap LP)</div>
              </div>
              <ul className="text-xs text-muted space-y-1 list-disc list-inside">
                <li>提取后 LP 会转入你的钱包</li>
                <li>之后你可以:重新添加流动性 / 在其他平台锁仓 / 销毁</li>
              </ul>
              <button onClick={handleClaim} disabled={isProcessing} className="w-full py-4 rounded-xl bg-green-500 hover:bg-green-600 text-white font-black text-lg transition-all disabled:opacity-50 shadow-lg shadow-green-500/30 hover:shadow-green-500/50">
                {isProcessing ? '⏳ 交易确认中...' : `🟢 提取 ${lock.lpAmount} LP`}
              </button>
            </div>
          )}

          {/* extend 模式 */}
          {mode === 'extend' && (
            <div className="glass rounded-2xl p-5 border-2 border-yellow-500/40 space-y-4 animate-slide-up" style={{ boxShadow: '0 0 40px rgba(252, 211, 77, 0.2)' }}>
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-yellow-400 text-lg">🔄 选择新的锁仓期限</h4>
                <button onClick={() => setMode('select')} className="btn-glass text-xs">← 返回</button>
              </div>

              <OptionGrid
                options={LOCK_PERIOD_OPTIONS.filter(o => o.value !== '0').map(opt => ({
                  value: opt.value,
                  emoji: opt.emoji,
                  label: opt.label,
                  color: opt.color.includes('red') ? '#fb7185' : '#fcd34d',
                }))}
                value={newPeriod}
                onChange={(v: string) => setNewPeriod(v)}
                cols={2}
                size="sm"
              />

              <InfoBadge type="warning">
                续锁会保留原 LP 数量,只更新到期时间。原锁仓记录会被标记为「已续锁」。
              </InfoBadge>

              <button onClick={handleExtend} disabled={isProcessing} className="w-full py-4 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-dark-300 font-black text-lg transition-all disabled:opacity-50 shadow-lg shadow-yellow-500/30">
                {isProcessing ? '⏳ 交易确认中...' :
                  `🔄 续锁到 ${LOCK_PERIOD_OPTIONS.find(p => p.value === newPeriod)?.label}`}
              </button>
            </div>
          )}

          {/* burn 模式 */}
          {mode === 'burn' && (
            <div className="glass rounded-2xl p-5 border-2 border-red-500/40 space-y-4 animate-slide-up" style={{ boxShadow: '0 0 40px rgba(251, 113, 133, 0.2)' }}>
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-red-400 text-lg">🔥 确认销毁 LP</h4>
                <button onClick={() => setMode('select')} className="btn-glass text-xs">← 返回</button>
              </div>

              <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/30 text-center">
                <div className="text-6xl mb-2 animate-pulse">💀</div>
                <p className="text-base text-red-400 font-bold">这是一个不可逆操作!</p>
                <p className="text-xs text-muted mt-2">销毁后 LP 直接烧毁,包括你在内任何人都无法提取</p>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="glass rounded-xl p-4">
                  <p className="text-xs text-green-400 font-bold mb-2">✅ 销毁的好处</p>
                  <ul className="text-xs text-secondary space-y-1 list-disc list-inside">
                    <li>彻底断绝跑路可能</li>
                    <li>对买家最强的信任信号</li>
                    <li>社区会认可你的诚意</li>
                  </ul>
                </div>
                <div className="glass rounded-xl p-4">
                  <p className="text-xs text-red-400 font-bold mb-2">⚠️ 风险</p>
                  <ul className="text-xs text-secondary space-y-1 list-disc list-inside">
                    <li>无法撤回操作</li>
                    <li>永远拿不回 LP</li>
                  </ul>
                </div>
              </div>

              <button onClick={handleBurn} disabled={isProcessing} className="w-full py-4 rounded-xl bg-red-500 hover:bg-red-600 text-white font-black text-lg transition-all disabled:opacity-50 shadow-lg shadow-red-500/30">
                {isProcessing ? '⏳ 交易确认中...' : `🔥 永久销毁 ${lock.lpAmount} LP`}
              </button>
            </div>
          )}
        </Section>
      )}

      <InfoBadge type="info" icon="💡">
        <div className="space-y-1 text-xs">
          <p className="font-bold">三个选项的区别</p>
          <p>
            <span className="text-green-400 font-bold">提取</span> = LP 转回你的钱包,你拥有完全控制权
          </p>
          <p>
            <span className="text-yellow-400 font-bold">续锁</span> = 保留 LP 在合约里,延长锁仓时间
          </p>
          <p>
            <span className="text-red-400 font-bold">销毁</span> = LP 直接烧毁,谁也拿不走(包括你自己)
          </p>
        </div>
      </InfoBadge>

      <div className="flex flex-wrap justify-center gap-4 text-sm pt-2">
        <Link to="/my-tokens" className="text-muted hover:text-banana transition-colors">← 返回我的代币</Link>
        <Link to="/create" className="text-muted hover:text-banana transition-colors">🍌 发行新代币</Link>
      </div>
    </div>
  )
}

function ActionButton({
  emoji, emojiBg, emojiBorder, emojiGlow, title, titleColor, desc, onClick,
}: {
  emoji: string
  emojiBg: string
  emojiBorder: string
  emojiGlow: string
  title: string
  titleColor: string
  desc: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full p-4 rounded-2xl border-2 text-center hover:scale-[1.04] active:scale-[0.98] transition-all duration-300 group cursor-pointer"
      style={{
        borderColor: emojiBorder,
        background: 'rgba(255,255,255,0.02)',
      }}
    >
      <div className="flex flex-col items-center gap-2">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 group-hover:rotate-3 transition-transform"
          style={{
            background: emojiBg,
            border: `1px solid ${emojiBorder}`,
            boxShadow: `0 0 20px ${emojiGlow}`,
          }}
        >
          {emoji}
        </div>
        <div className="font-display font-black text-base" style={{ color: titleColor }}>{title}</div>
        <div className="text-[0.7rem] text-muted leading-snug">{desc}</div>
        <div className="mt-1 text-[0.65rem] font-mono opacity-70 group-hover:opacity-100 transition-opacity flex items-center gap-1">
          <span>点击</span>
          <span className="group-hover:translate-x-0.5 transition-transform">→</span>
        </div>
      </div>
    </button>
  )
}
