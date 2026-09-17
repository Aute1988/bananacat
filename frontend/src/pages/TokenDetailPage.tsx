/**
 * 🍌 香蕉猫发射台 - 代币详情页
 * 高大上 · 科技感 · 颗粒感 设计语言
 */
import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useWallet } from '../hooks/useWallet'
import { useWalletClient } from 'wagmi'
import { LOCK_PERIOD_LABELS, CHAINS } from '../chains/config'
import CombinedChart from '../components/CombinedChart'
import CommentSection from '../components/CommentSection'
import { buyTokenOnChain, sellTokenOnChain } from '../lib/contracts'
import {
  PageHero,
  EmptyState,
  SkeletonCard,
  StatusPill,
  KeyValue,
  Progress,
  CompactCard,
  StatBadge,
  InfoBadge,
  toast,
} from '../components/UI'

// 真实链上数据(从后端 /api/tokens/:chainId/:address 获取)
interface TokenInfo {
  address: string
  chainId: number
  name: string
  symbol: string
  description: string
  imageUrl: string
  websiteUrl: string
  twitterUrl: string
  telegramUrl: string
  label: number
  labelName: string
  buyTaxBps: number
  sellTaxBps: number
  transferTaxBps: number
  maxBuyPerWallet: number
  launchTime: number
  creator: string
  lockPeriod: number
  graduated: boolean
  curveAddress: string
  // 后端返回的扩展字段
  createdAt?: string | number
  holders?: number
  chain?: string
  progress?: number
  currencyReserve?: string
  price?: string
  marketCap?: string
  tokensSold?: string
  totalSupply?: string
  mode?: 'NORMAL' | 'TAX'
  buyTax?: number
  sellTax?: number
  transferTax?: number
  recentTx?: Array<{
    type: string
    amount: string
    user: string
    time: string
    txHash: string
    price?: string
    addr?: string
  }>
}

export default function TokenDetailPage() {
  const { chainId, address } = useParams<{ chainId: string; address: string }>()
  const { address: walletAddress, chain } = useWallet()
  const { data: walletClient } = useWalletClient()
  const [tab, setTab] = useState<'trade' | 'info' | 'tx'>('trade')
  const [buyAmount, setBuyAmount] = useState('')
  const [sellAmount, setSellAmount] = useState('')
  const [isBuying, setIsBuying] = useState(false)
  const [isSelling, setIsSelling] = useState(false)
  const [token, setToken] = useState<TokenInfo | null>(null)
  const [loading, setLoading] = useState(true)

  // 从后端 API 加载代币信息
  useEffect(() => {
    if (!chainId || !address) return
    let cancelled = false
    setLoading(true)
    fetch(
      `${import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE || 'http://localhost:3001'}/api/tokens/${chainId}/${address}`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return
        if (data?.token) setToken(data.token as TokenInfo)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [chainId, address])

  // 正确获取 chainConfig，兼容 address 找不到的情况
  const chainConfig = CHAINS[chain as keyof typeof CHAINS] ?? CHAINS.bsc
  const nativeSymbol = chainConfig?.nativeCurrency?.symbol ?? 'BNB'

  const handleBuy = async () => {
    if (!walletAddress) return toast('请先连接钱包', 'error')
    const amount = parseFloat(buyAmount)
    if (isNaN(amount) || amount <= 0) return toast('请输入合法的买入金额', 'error')
    if (!token?.curveAddress) return toast('该代币尚未发布或未找到联合曲线', 'error')

    setIsBuying(true)
    try {
      if (!walletClient) throw new Error('钱包未就绪,请先连接钱包')
      if (!token.curveAddress) throw new Error('该代币尚未发布或未找到联合曲线')

      // 校验浮点精度安全范围(<2^53)
      if (amount > Number.MAX_SAFE_INTEGER / 1e18) {
        throw new Error('金额过大,请输入更小的数字')
      }
      const valueWei = BigInt(Math.floor(amount * 1e18))
      const txHash = await buyTokenOnChain(
        walletClient,
        token.curveAddress as `0x${string}`,
        0n,
        valueWei,
        chain ?? 'bsc'
      )
      toast(`买入成功! 交易哈希: ${txHash.slice(0, 10)}...`, 'success')
      setBuyAmount('')
    } catch (err: any) {
      toast('买入失败: ' + (err.message || err.shortMessage || '未知错误'), 'error')
    } finally {
      setIsBuying(false)
    }
  }

  const handleSell = async () => {
    if (!walletAddress) return toast('请先连接钱包', 'error')
    const amount = parseFloat(sellAmount)
    if (isNaN(amount) || amount <= 0) return toast('请输入合法的卖出数量', 'error')
    if (!token?.curveAddress) return toast('该代币尚未发布或未找到联合曲线', 'error')

    setIsSelling(true)
    try {
      if (!walletClient) throw new Error('钱包未就绪')

      if (amount > Number.MAX_SAFE_INTEGER / 1e18) {
        throw new Error('数量过大,请输入更小的数字')
      }
      const tokenAmount = BigInt(Math.floor(amount * 1e18))
      const txHash = await sellTokenOnChain(
        walletClient,
        token.curveAddress as `0x${string}`,
        tokenAmount,
        0n,
        chain ?? 'bsc'
      )
      toast(`卖出成功! 交易哈希: ${txHash.slice(0, 10)}...`, 'success')
      setSellAmount('')
    } catch (err: any) {
      toast('卖出失败: ' + (err.message || err.shortMessage || '未知错误'), 'error')
    } finally {
      setIsSelling(false)
    }
  }

  // Loading 状态
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <SkeletonCard variant="card" rows={1} />
        <div className="mt-6">
          <SkeletonCard variant="row" rows={3} />
        </div>
      </div>
    )
  }

  // Error / 不存在状态
  if (!token) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-20">
        <EmptyState
          emoji="🐱"
          title="代币不存在或已被删除"
          desc="该代币可能已被销毁或地址输入错误"
          action={{ label: '← 返回代币列表', onClick: () => window.history.back() }}
        />
      </div>
    )
  }

  // 代币类型
  const tokenChainId =
    token.chain === 'bsc'
      ? 97
      : token.chain === 'ethereum'
        ? 11155111
        : token.chain === 'robinhood'
          ? 46630
          : 5042002

  return (
    <div className="max-w-6xl mx-auto px-4 pb-16 animate-fade-in">

      {/* ============================================================
          头部 Token 信息区域
          glass-premium rounded-3xl p-6 sm:p-8 + 头像 + 渐变 + 浮动动画 + glow shadow
      ============================================================ */}
      <div className="glass-premium rounded-3xl p-6 sm:p-8 mb-6 relative overflow-hidden animate-fade-in">
        {/* 背景辉光 */}
        <div className="absolute -top-20 -right-20 w-52 h-52 rounded-full opacity-25 blur-3xl pointer-events-none animate-float"
          style={{ background: 'radial-gradient(circle, rgba(252, 211, 77, 0.5), transparent 70%)' }} />
        <div className="absolute -bottom-20 -left-20 w-52 h-52 rounded-full opacity-20 blur-3xl pointer-events-none animate-float-reverse"
          style={{ background: 'radial-gradient(circle, rgba(183, 148, 246, 0.5), transparent 70%)' }} />

        <div className="relative flex items-start gap-5 flex-wrap">
          {/* 头像 */}
          <div className="shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-2xl sm:rounded-3xl flex items-center justify-center text-5xl sm:text-6xl animate-float shadow-lg"
            style={{
              background: 'linear-gradient(135deg, rgba(252, 211, 77, 0.25), rgba(244, 114, 182, 0.15))',
              border: '1px solid rgba(252, 211, 77, 0.4)',
              boxShadow: '0 0 48px rgba(252, 211, 77, 0.2), 0 0 96px rgba(252, 211, 77, 0.08)',
            }}>
            🐱
          </div>

          <div className="flex-1 min-w-0">
            {/* 名称行 */}
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <h1 className="font-display text-3xl sm:text-5xl font-black tracking-tighter text-gradient-banana">
                {token.name}
              </h1>
              <span className="text-gray-500 text-xl sm:text-2xl font-bold">{token.symbol}</span>
            </div>

            {/* 标签行: StatusPill */}
            <div className="flex items-center gap-2 flex-wrap mb-4">
              <StatusPill
                variant={token.graduated ? 'success' : token.lockPeriod === 5 ? 'danger' : 'warning'}
                icon={token.graduated ? '🎓' : '🔒'}
                pulse={!token.graduated && token.lockPeriod === 5}
              >
                {token.graduated ? '已毕业' : LOCK_PERIOD_LABELS[token.lockPeriod] ?? `锁仓 ${token.lockPeriod}`}
              </StatusPill>
              {token.mode?.toLowerCase() === 'tax' && (
                <StatusPill variant="warning" icon="💸">税率模式</StatusPill>
              )}
            </div>

            {/* 元信息: 链/创建者/创建时间/持有者 */}
            <div className="flex items-center gap-4 flex-wrap text-sm">
              <div className="flex items-center gap-1.5">
                <span className="text-muted">链</span>
                <StatBadge color="#7dd3fc">{chainConfig?.emoji} {chainConfig?.nameCn ?? token.chain}</StatBadge>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-muted">创建者</span>
                <StatBadge color="#fcd34d">
                  {token.creator ? `${token.creator.slice(0, 6)}...${token.creator.slice(-4)}` : '—'}
                </StatBadge>
              </div>
              {token.createdAt && (
                <div className="flex items-center gap-1.5">
                  <span className="text-muted">创建于</span>
                  <StatBadge color="#b794f6">{String(token.createdAt).slice(0, 10)}</StatBadge>
                </div>
              )}
              {token.holders != null && (
                <div className="flex items-center gap-1.5">
                  <span className="text-muted">持有者</span>
                  <StatBadge color="#34d399">{token.holders.toLocaleString()}</StatBadge>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================
          主布局: lg 以下单列, lg 以上双列 (2:1)
      ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ==================== 左侧: 主内容区 ==================== */}
        <div className="lg:col-span-2 space-y-6">

          {/* K 线图区域 */}
          <div className="glass-premium rounded-3xl p-4 sm:p-6">
            <CombinedChart
              chainId={tokenChainId}
              address={token.address}
              symbol={token.symbol}
              currencySymbol={nativeSymbol}
            />
          </div>

          {/* 联合曲线进度 */}
          <div className="glass-premium rounded-3xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">📈</span>
                <span className="font-display text-lg font-bold text-white">联合曲线进度</span>
              </div>
              <span className="font-orbitron font-black text-2xl text-gradient-banana">
                {(token.progress ?? 0).toFixed(1)}%
              </span>
            </div>

            <Progress
              value={token.progress ?? 0}
              color={token.graduated ? '#34d399' : '#fcd34d'}
              height={10}
            />

            <div className="flex items-center justify-between mt-3 text-xs font-mono text-muted">
              <span>已积累 {token.currencyReserve ?? '0'} {nativeSymbol}</span>
              <span>目标: 24 {nativeSymbol}</span>
            </div>

            {/* 信息徽章 */}
            {token.graduated ? (
              <div className="mt-4">
                <InfoBadge type="success" icon="✅">
                  已毕业！该代币现已在 PancakeSwap 公开交易，可在更大流动池中买卖。
                </InfoBadge>
              </div>
            ) : (
              <div className="mt-4">
                <InfoBadge type="info" icon="💡">
                  当进度达到 100%，代币将自动迁移到 PancakeSwap 进行公开交易。
                </InfoBadge>
              </div>
            )}
          </div>

          {/* ==================== Tab 切换器 ==================== */}
          <div className="glass-premium rounded-3xl overflow-hidden">
            {/* Tab 栏 */}
            <div className="flex border-b border-white/5">
              {(['trade', 'info', 'tx'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-3.5 text-sm font-bold transition-all duration-300 relative ${
                    tab === t
                      ? 'text-yellow-400'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <span className="relative z-10">
                    {t === 'trade' ? '📊 交易' : t === 'info' ? 'ℹ️ 信息' : '📜 交易记录'}
                  </span>
                  {tab === t && (
                    <>
                      {/* 顶部高光线 */}
                      <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-yellow-400/60 to-transparent" />
                      {/* 活跃玻璃背景 */}
                      <div className="absolute inset-0 glass-strong z-0" />
                    </>
                  )}
                </button>
              ))}
            </div>

            {/* ==================== Tab: 交易面板 ==================== */}
            {tab === 'trade' && (
              <div className="p-6 space-y-5">
                {token.graduated ? (
                  <div className="text-center py-10 space-y-4">
                    <div className="text-6xl animate-float inline-block">🎓</div>
                    <div>
                      <p className="text-secondary font-medium">该代币已毕业，现在在 PancakeSwap 交易</p>
                    </div>
                    <a
                      href={`https://pancakeswap.finance/swap?inputCurrency=BNB&outputCurrency=${token.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-banana inline-flex items-center gap-2"
                    >
                      前往 PancakeSwap ↗
                    </a>
                  </div>
                ) : (
                  <>
                    {/* 价格信息 3 列 */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="glass rounded-xl p-4 text-center">
                        <div className="text-[0.65rem] text-muted uppercase tracking-widest mb-1">当前价格</div>
                        <div className="font-orbitron font-bold text-white text-sm truncate">
                          {token.price ?? '—'} {nativeSymbol}
                        </div>
                      </div>
                      <div className="glass rounded-xl p-4 text-center">
                        <div className="text-[0.65rem] text-muted uppercase tracking-widest mb-1">市值</div>
                        <div className="font-orbitron font-bold text-white text-sm truncate">
                          {token.marketCap ?? '—'} {nativeSymbol}
                        </div>
                      </div>
                      <div className="glass rounded-xl p-4 text-center">
                        <div className="text-[0.65rem] text-muted uppercase tracking-widest mb-1">已发行</div>
                        <div className="font-orbitron font-bold text-white text-sm truncate">
                          {token.tokensSold ?? '—'}
                        </div>
                      </div>
                    </div>

                    {/* 未连接钱包提示 */}
                    {!walletAddress && (
                      <div className="glass rounded-xl p-4 text-center text-sm text-muted">
                        连接钱包后可进行交易
                      </div>
                    )}

                    {/* 买入区 */}
                    <div className="p-5 rounded-2xl relative overflow-hidden"
                      style={{
                        background: 'rgba(52, 211, 153, 0.04)',
                        border: '1px solid rgba(52, 211, 153, 0.25)',
                        boxShadow: '0 0 32px rgba(52, 211, 153, 0.08) inset',
                      }}>
                      {/* 辉光 */}
                      <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-20 blur-2xl pointer-events-none"
                        style={{ background: 'radial-gradient(circle, rgba(52, 211, 153, 0.6), transparent 70%)' }} />
                      <div className="relative">
                        <div className="flex items-center justify-between mb-4">
                          <span className="font-bold text-green-400 flex items-center gap-2">
                            🟢 买入
                          </span>
                          <span className="text-xs text-muted font-mono">手续费 ~1%</span>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={buyAmount}
                            onChange={(e) => setBuyAmount(e.target.value)}
                            placeholder="输入买入数量..."
                            className="flex-1 banana-input"
                          />
                          <button
                            onClick={handleBuy}
                            disabled={isBuying}
                            className="px-6 py-3 rounded-xl font-bold text-sm transition-all whitespace-nowrap"
                            style={{
                              background: 'linear-gradient(135deg, #34d399, #10b981)',
                              color: '#000',
                              boxShadow: '0 4px 16px rgba(52, 211, 153, 0.35)',
                            }}
                          >
                            {isBuying ? '处理中...' : '买入'}
                          </button>
                        </div>
                        {buyAmount && !isNaN(parseFloat(buyAmount)) && (
                          <div className="text-xs text-muted mt-2 font-mono">
                            估算花费:{' '}
                            <span className="text-green-400">
                              {(parseFloat(buyAmount) * parseFloat(token.price ?? '0') * 1.01).toFixed(6)} {nativeSymbol}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 卖出区 */}
                    <div className="p-5 rounded-2xl relative overflow-hidden"
                      style={{
                        background: 'rgba(251, 113, 133, 0.04)',
                        border: '1px solid rgba(251, 113, 133, 0.25)',
                        boxShadow: '0 0 32px rgba(251, 113, 133, 0.08) inset',
                      }}>
                      {/* 辉光 */}
                      <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-20 blur-2xl pointer-events-none"
                        style={{ background: 'radial-gradient(circle, rgba(251, 113, 133, 0.6), transparent 70%)' }} />
                      <div className="relative">
                        <div className="flex items-center justify-between mb-4">
                          <span className="font-bold text-red-400 flex items-center gap-2">
                            🔴 卖出
                          </span>
                          <span className="text-xs text-muted font-mono">手续费 ~1%</span>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={sellAmount}
                            onChange={(e) => setSellAmount(e.target.value)}
                            placeholder="输入卖出数量..."
                            className="flex-1 banana-input"
                          />
                          <button
                            onClick={handleSell}
                            disabled={isSelling}
                            className="px-6 py-3 rounded-xl font-bold text-sm transition-all whitespace-nowrap"
                            style={{
                              background: 'linear-gradient(135deg, #fb7185, #e11d48)',
                              color: '#fff',
                              boxShadow: '0 4px 16px rgba(251, 113, 133, 0.35)',
                            }}
                          >
                            {isSelling ? '处理中...' : '卖出'}
                          </button>
                        </div>
                        {sellAmount && !isNaN(parseFloat(sellAmount)) && (
                          <div className="text-xs text-muted mt-2 font-mono">
                            估算获得:{' '}
                            <span className="text-red-400">
                              {(parseFloat(sellAmount) * parseFloat(token.price ?? '0') * 0.99).toFixed(6)} {nativeSymbol}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ==================== Tab: 信息面板 ==================== */}
            {tab === 'info' && (
              <div className="p-6 space-y-5">
                {/* 基本信息 KeyValue 列表 */}
                <CompactCard>
                  <div className="space-y-0">
                    <KeyValue
                      label="代币地址"
                      value={
                        <span className="text-xs">
                          {token.address ? `${token.address.slice(0, 10)}...${token.address.slice(-8)}` : '—'}
                        </span>
                      }
                      mono
                      copyable
                    />
                    <KeyValue
                      label="总供应量"
                      value={token.totalSupply ?? '—'}
                      mono
                    />
                    <KeyValue
                      label="已卖出"
                      value={token.tokensSold ?? '—'}
                      mono
                    />
                    <KeyValue
                      label="当前价格"
                      value={`${token.price ?? '—'} ${nativeSymbol}`}
                      mono
                    />
                    <KeyValue
                      label="创建者"
                      value={
                        token.creator ? (
                          <span className="text-xs">{`${token.creator.slice(0, 8)}...${token.creator.slice(-6)}`}</span>
                        ) : (
                          '—'
                        )
                      }
                      mono
                      copyable
                    />
                    <KeyValue
                      label="分类"
                      value={token.labelName ? `${token.labelName} 类别` : '—'}
                    />
                    <KeyValue
                      label="锁仓期限"
                      value={LOCK_PERIOD_LABELS[token.lockPeriod] ?? `锁仓 ${token.lockPeriod}`}
                    />
                    <KeyValue
                      label="最大单地址买入"
                      value={
                        token.maxBuyPerWallet > 0
                          ? `${token.maxBuyPerWallet.toLocaleString()} ${token.symbol}`
                          : '无限制'
                      }
                      mono
                    />
                  </div>
                </CompactCard>

                {/* 税率模式区域 */}
                {token.mode?.toLowerCase() === 'tax' && (
                  <CompactCard>
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">💸</span>
                        <span className="font-bold text-orange-400">税率模式 (Tax Token)</span>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="glass rounded-xl p-4 text-center">
                          <div className="font-orbitron font-black text-2xl text-orange-400">{token.buyTax ?? 0}%</div>
                          <div className="text-[0.65rem] text-muted mt-1 uppercase tracking-wider">买入税</div>
                        </div>
                        <div className="glass rounded-xl p-4 text-center">
                          <div className="font-orbitron font-black text-2xl text-orange-400">{token.sellTax ?? 0}%</div>
                          <div className="text-[0.65rem] text-muted mt-1 uppercase tracking-wider">卖出税</div>
                        </div>
                        <div className="glass rounded-xl p-4 text-center">
                          <div className="font-orbitron font-black text-2xl text-orange-400">{token.transferTax ?? 0}%</div>
                          <div className="text-[0.65rem] text-muted mt-1 uppercase tracking-wider">转账税</div>
                        </div>
                      </div>
                      <InfoBadge type="warning" icon="⚠️">
                        该代币为税率模式，每次转账将扣除相应比例的税费。
                      </InfoBadge>
                    </div>
                  </CompactCard>
                )}

                {/* 社交链接区域 */}
                {(token.websiteUrl || token.twitterUrl || token.telegramUrl) && (
                  <CompactCard>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-muted uppercase tracking-widest">
                        🌐 社交链接
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {token.websiteUrl && (
                          <a
                            href={token.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-glass text-sm"
                          >
                            🌍 官网
                          </a>
                        )}
                        {token.twitterUrl && (
                          <a
                            href={token.twitterUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-glass text-sm"
                          >
                            🐦 X (Twitter)
                          </a>
                        )}
                        {token.telegramUrl && (
                          <a
                            href={token.telegramUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-glass text-sm"
                          >
                            ✈️ Telegram
                          </a>
                        )}
                      </div>
                    </div>
                  </CompactCard>
                )}

                {/* 描述 */}
                {token.description && (
                  <CompactCard>
                    <div className="space-y-2">
                      <div className="text-sm text-muted uppercase tracking-widest">📝 描述</div>
                      <p className="text-sm text-secondary leading-relaxed">{token.description}</p>
                    </div>
                  </CompactCard>
                )}
              </div>
            )}

            {/* ==================== Tab: 交易记录 ==================== */}
            {tab === 'tx' && (
              <div className="p-6 space-y-1">
                {(token.recentTx ?? []).length === 0 ? (
                  <div className="text-center py-10 text-muted text-sm">
                    暂无交易记录
                  </div>
                ) : (
                  token.recentTx!.map((tx, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 py-3 border-b border-white/5 last:border-0 text-sm hover:bg-white/[0.02] transition-colors rounded-lg px-2 -mx-2"
                    >
                      {/* 类型圆点 */}
                      <span
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          tx.type === 'buy' ? 'bg-green-400' : 'bg-red-400'
                        }`}
                      />
                      <span
                        className={`shrink-0 font-bold ${
                          tx.type === 'buy' ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        {tx.type === 'buy' ? '买入' : '卖出'}
                      </span>
                      <span className="text-white font-mono text-xs shrink-0">{tx.amount}</span>
                      <span className="text-muted font-mono text-xs shrink-0">@ {tx.price ?? '—'}</span>
                      <span className="text-gray-600 text-xs shrink-0 ml-auto">{tx.time}</span>
                      <span className="text-gray-500 font-mono text-xs shrink-0">
                        {(tx as any).addr ?? tx.user
                          ? `${((tx as any).addr ?? tx.user).slice(0, 6)}...${((tx as any).addr ?? tx.user).slice(-4)}`
                          : ''}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* ==================== 右侧: Lock 信息 + 快捷操作 ==================== */}
        <div className="space-y-5">

          {/* 锁仓信息面板 */}
          <div className="glass-premium rounded-3xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔐</span>
              <span className="font-display text-lg font-bold text-white">锁仓信息</span>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted">锁仓期限</span>
                <StatusPill
                  variant={token.lockPeriod === 5 ? 'danger' : 'warning'}
                  icon={token.lockPeriod === 5 ? '💀' : '🔒'}
                >
                  {LOCK_PERIOD_LABELS[token.lockPeriod] ?? `锁仓 ${token.lockPeriod}`}
                </StatusPill>
              </div>

              {token.lockPeriod === 5 ? (
                <InfoBadge type="danger" icon="💀">
                  LP 已永久销毁，包括发币者在内任何人都无法提取流动性。
                </InfoBadge>
              ) : (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted">解锁时间</span>
                    <StatBadge color="#fcd34d">2025-09-23</StatBadge>
                  </div>
                  <InfoBadge type="warning" icon="🔒">
                    还有 7 天 14 小时解锁
                  </InfoBadge>
                </>
              )}
            </div>
          </div>

          {/* 快捷操作按钮组 */}
          <div className="glass-premium rounded-3xl p-6 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">⚡</span>
              <span className="font-display text-lg font-bold text-white">快捷操作</span>
            </div>
            <div className="space-y-2">
              <Link to="/create" className="btn-banana w-full text-center block text-sm py-2.5">
                🍌 发行新代币
              </Link>
              <Link
                to="/my-tokens"
                className="w-full block text-center py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm hover:border-white/25 hover:text-gray-300 transition-all font-medium"
              >
                👤 我的代币
              </Link>
            </div>
          </div>

          {/* 代币统计 */}
          <div className="glass-premium rounded-3xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">📊</span>
              <span className="font-display text-lg font-bold text-white">代币统计</span>
            </div>
            <div className="space-y-3">
              {[
                { label: '进度', value: `${(token.progress ?? 0).toFixed(1)}%`, color: '#fcd34d' },
                { label: '持有者', value: `${token.holders ?? 0}`, color: '#34d399' },
                { label: '已发行', value: `${token.tokensSold ?? '—'}`, color: '#7dd3fc' },
                { label: '市值', value: `${token.marketCap ?? '—'} ${nativeSymbol}`, color: '#b794f6' },
              ].map((item) => (
                <div key={item.label} className="flex justify-between items-center">
                  <span className="text-sm text-muted">{item.label}</span>
                  <StatBadge color={item.color}>{item.value}</StatBadge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================
          评论区
          glass-premium rounded-3xl p-6 sm:p-8
      ============================================================ */}
      <div className="glass-premium rounded-3xl p-6 sm:p-8 mt-6">
        <CommentSection
          tokenAddress={address || ''}
          chainId={tokenChainId}
        />
      </div>
    </div>
  )
}
