import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CHAINS } from '../chains/config'
import { PageHero, EmptyState, StatusPill, Progress, CompactCard, StatBadge, toast } from '../components/UI'

// 模拟代币数据(真实场景由后端索引器提供)
const MOCK_TOKENS = [
  {
    address: '0x1234567890abcdef1234567890abcdef12345678',
    name: 'Bitcoin Cat',
    symbol: 'BCAT',
    creator: '0xabcd...ef01',
    lockPeriod: 4,
    graduated: false,
    progress: 67.5,
    marketCap: '8.12',
    priceChange: '+15.3%',
    chain: 'bsc' as const,
    createdAt: '2小时前',
  },
  {
    address: '0x2234567890abcdef1234567890abcdef22345678',
    name: 'Pepe Banana',
    symbol: 'PEPEB',
    creator: '0x2222...3333',
    lockPeriod: 5, // 永久销毁
    graduated: true,
    progress: 100,
    marketCap: '156.8',
    priceChange: '+89.2%',
    chain: 'bsc' as const,
    createdAt: '1天前',
  },
  {
    address: '0x3234567890abcdef1234567890abcdef32345678',
    name: 'Meme King',
    symbol: 'MKM',
    creator: '0x3333...4444',
    lockPeriod: 2,
    graduated: false,
    progress: 23.1,
    marketCap: '2.45',
    priceChange: '-5.2%',
    chain: 'ethereum' as const,
    createdAt: '3小时前',
  },
  {
    address: '0x4234567890abcdef1234567890abcdef42345678',
    name: 'Dog Coin',
    symbol: 'DOG',
    creator: '0x4444...5555',
    lockPeriod: 1,
    graduated: false,
    progress: 89.2,
    marketCap: '12.34',
    priceChange: '+3.1%',
    chain: 'robinhood' as const,
    createdAt: '5小时前',
  },
  {
    address: '0x5234567890abcdef1234567890abcdef52345678',
    name: 'Safe Moon Cat',
    symbol: 'SMC',
    creator: '0x5555...6666',
    lockPeriod: 5, // 永久销毁
    graduated: false,
    progress: 45.6,
    marketCap: '5.67',
    priceChange: '+22.4%',
    chain: 'arc' as const,
    createdAt: '30分钟前',
  },
]

// 根据进度值获取颜色
const getProgressColor = (value: number, graduated: boolean): string => {
  if (graduated) return '#34d399' // 绿色 - 已毕业
  if (value < 50) return '#fcd34d' // 黄色
  if (value < 80) return '#fb923c' // 橙色
  return '#e879f9' // 粉紫
}

// 锁仓状态配置
const LOCK_STATUS_CONFIG: Record<number, { label: string; icon: string; variant: 'neutral' | 'warning' | 'info' | 'danger' | 'success' }> = {
  0: { label: '无锁仓', icon: '⚠️', variant: 'warning' },
  1: { label: '1天', icon: '🔒', variant: 'neutral' },
  2: { label: '7天', icon: '🔒', variant: 'neutral' },
  3: { label: '30天', icon: '🔒', variant: 'info' },
  4: { label: '1年', icon: '🔒', variant: 'neutral' },
  5: { label: '永久销毁', icon: '🔥', variant: 'danger' },
}

type FilterChain = 'all' | 'bsc' | 'ethereum' | 'robinhood' | 'arc'

export default function TokenListPage() {
  const [filterChain, setFilterChain] = useState<FilterChain>('all')
  const [filterGraduated, setFilterGraduated] = useState<'all' | 'trading' | 'graduated'>('all')
  const [search, setSearch] = useState('')

  const filtered = MOCK_TOKENS.filter(token => {
    if (filterChain !== 'all' && token.chain !== filterChain) return false
    if (filterGraduated === 'trading' && token.graduated) return false
    if (filterGraduated === 'graduated' && !token.graduated) return false
    if (search && !token.name.toLowerCase().includes(search.toLowerCase()) && !token.symbol.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="space-y-6">
      {/* 顶部 Hero */}
      <PageHero
        icon="📋"
        title="代币列表"
        subtitle="浏览所有 Meme 代币,找到下一个百倍币"
        badge={
          <StatBadge color="#fcd34d">{filtered.length} 个代币</StatBadge>
        }
        actions={
          <Link to="/create" className="btn-banana text-sm py-2.5 px-5">
            🍌 发币
          </Link>
        }
        variant="gold"
      />

      {/* 筛选栏 - 玻璃效果 */}
      <div className="glass rounded-2xl p-4 sm:p-5 animate-fade-in relative overflow-hidden">
        {/* 顶部高光线 */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
        
        <div className="relative">
          {/* 移动端横向滚动容器 */}
          <div className="flex flex-wrap gap-3 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
            {/* 链筛选 */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted font-medium">链:</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { key: 'all', label: '全部' },
                  ...Object.entries(CHAINS).map(([k, v]) => ({ key: k, label: `${v.emoji} ${v.nameCn}` })),
                ].map(item => (
                  <button
                    key={item.key}
                    onClick={() => setFilterChain(item.key as FilterChain)}
                    className={`btn-glass text-xs py-1.5 px-3 rounded-lg transition-all ${
                      filterChain === item.key
                        ? 'border-banana/50 bg-banana/10 text-banana'
                        : 'text-secondary hover:text-primary'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 状态筛选 */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted font-medium">状态:</span>
              <div className="flex items-center gap-1.5">
                {[
                  { key: 'all', label: '全部' },
                  { key: 'trading', label: '📈 交易中' },
                  { key: 'graduated', label: '🎓 已毕业' },
                ].map(item => (
                  <button
                    key={item.key}
                    onClick={() => setFilterGraduated(item.key as typeof filterGraduated)}
                    className={`btn-glass text-xs py-1.5 px-3 rounded-lg transition-all ${
                      filterGraduated === item.key
                        ? 'border-cat/50 bg-cat/10 text-cat'
                        : 'text-secondary hover:text-primary'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 搜索框 */}
            <div className="shrink-0 min-w-[160px]">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="搜索代币..."
                className="banana-input text-xs py-1.5 px-3 rounded-lg w-full"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 代币列表 */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <EmptyState
            emoji="🔍"
            title="没有找到符合条件的代币"
            desc="尝试调整筛选条件或搜索关键词"
            action={{
              label: '重置筛选',
              onClick: () => {
                setFilterChain('all')
                setFilterGraduated('all')
                setSearch('')
                toast('已重置筛选条件', 'info')
              },
              variant: 'secondary',
            }}
          />
        ) : (
          filtered.map((token, index) => {
            const chainConfig = CHAINS[token.chain]
            const lockConfig = LOCK_STATUS_CONFIG[token.lockPeriod]
            const progressColor = getProgressColor(token.progress, token.graduated)
            const isPositive = token.priceChange.startsWith('+')

            return (
              <Link
                key={token.address}
                to={`/token/${token.chain}/${token.address}`}
                className="block group animate-slide-up"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                {/* 玻璃高级卡片 */}
                <div className="glass-premium rounded-2xl p-4 sm:p-5 transition-all duration-300 ease-out-expo hover:scale-[1.01] relative overflow-hidden">
                  {/* 右上角发光圆 */}
                  <div className="absolute -top-16 -right-16 w-32 h-32 rounded-full opacity-20 blur-3xl pointer-events-none transition-opacity group-hover:opacity-35"
                    style={{ background: `radial-gradient(circle, ${progressColor}60, transparent 70%)` }}
                  ></div>
                  
                  {/* 玻璃高光 */}
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none"></div>

                  <div className="relative flex items-start gap-4">
                    {/* Logo */}
                    <div className="shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-2xl sm:text-3xl relative"
                      style={{
                        background: 'linear-gradient(135deg, rgba(252, 211, 77, 0.15), rgba(244, 114, 182, 0.1))',
                        border: '1px solid rgba(252, 211, 77, 0.3)',
                        boxShadow: '0 8px 24px rgba(252, 211, 77, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                      }}>
                      🐱
                      {/* 毕业徽章 */}
                      {token.graduated && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs"
                          style={{
                            background: 'linear-gradient(135deg, #34d399, #10b981)',
                            boxShadow: '0 0 8px rgba(52, 211, 153, 0.5)',
                          }}>
                          ✓
                        </div>
                      )}
                    </div>

                    {/* 中间信息 */}
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* 第一行: 名称 + 符号 + 状态标签 */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-base sm:text-lg text-primary tracking-tight">{token.name}</span>
                        <span className="font-mono text-sm text-muted">{token.symbol}</span>
                        
                        {/* 锁仓状态 */}
                        <StatusPill variant={lockConfig.variant} icon={lockConfig.icon}>
                          {lockConfig.label}
                        </StatusPill>
                        
                        {/* 毕业标签 */}
                        {token.graduated && (
                          <StatusPill variant="success" icon="🎓">
                            已毕业
                          </StatusPill>
                        )}
                      </div>

                      {/* 第二行: 链 + 创建者 + 时间 */}
                      <div className="flex items-center gap-3 text-xs text-muted flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          <span>{chainConfig.emoji}</span>
                          <span>{chainConfig.nameCn}</span>
                        </span>
                        <span className="text-white/20">|</span>
                        <span className="font-mono">Creator: {token.creator}</span>
                        <span className="text-white/20">|</span>
                        <span>{token.createdAt}</span>
                      </div>

                      {/* 第三行: 进度条 */}
                      <div className="pt-1">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs text-muted">曲线进度</span>
                          <span className="font-orbitron text-xs font-bold" style={{ color: progressColor }}>
                            {token.progress.toFixed(1)}%
                          </span>
                        </div>
                        <Progress 
                          value={token.progress} 
                          color={progressColor}
                          height={6}
                        />
                      </div>
                    </div>

                    {/* 右侧数据 */}
                    <div className="shrink-0 text-right space-y-2 min-w-[100px] sm:min-w-[120px]">
                      {/* 价格变动 */}
                      <div className={`text-base sm:text-lg font-bold font-orbitron ${isPositive ? 'text-green-400' : 'text-red-400'}`}
                        style={{
                          textShadow: isPositive ? '0 0 16px rgba(52, 211, 153, 0.4)' : '0 0 16px rgba(251, 113, 133, 0.4)',
                        }}>
                        {token.priceChange}
                      </div>
                      
                      {/* 市值 */}
                      <div className="space-y-1">
                        <div className="text-xs text-muted">市值</div>
                        <div className="font-orbitron text-sm font-bold text-primary">${token.marketCap}B</div>
                      </div>

                      {/* 链标签 */}
                      <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                        }}>
                        <span>{chainConfig.emoji}</span>
                        <span className="text-muted uppercase">{token.chain}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })
        )}
      </div>

      {/* 底部说明 */}
      <div className="text-center py-6 animate-fade-in">
        <div className="inline-flex items-center gap-2 glass rounded-full px-5 py-2.5">
          <span className="text-sm text-muted">共</span>
          <StatBadge color="#fcd34d">{filtered.length}</StatBadge>
          <span className="text-sm text-muted">个代币</span>
          <span className="text-white/20">·</span>
          <span className="text-xs text-muted">数据仅供参考,不构成投资建议</span>
        </div>
      </div>
    </div>
  )
}
