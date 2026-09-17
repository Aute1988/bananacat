import { Link } from 'react-router-dom'
import { CHAINS } from '../chains/config'
import { useQuery } from '@tanstack/react-query'
import TokenRow from '../components/TokenRow'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const FEATURES = [
  {
    emoji: '🔐',
    title: 'LP 锁仓自选',
    desc: '发币者自选锁仓期限，到期后才可提取流动性。永久销毁 = 彻底跑路不了。',
    gradient: 'linear-gradient(135deg, #fcd34d, #ea580c)',
    accent: '#fcd34d',
    glow: 'rgba(252, 211, 77, 0.4)',
    iconBg: 'rgba(252, 211, 77, 0.15)',
    tag: '核心',
  },
  {
    emoji: '⚡',
    title: '一键发币',
    desc: '填名字、选 Logo、设锁仓，3 步完成发币。无需写代码，0.005 BNB 即可发射。',
    gradient: 'linear-gradient(135deg, #d8b4fe, #ec4899)',
    accent: '#d8b4fe',
    glow: 'rgba(216, 180, 254, 0.4)',
    iconBg: 'rgba(216, 180, 254, 0.15)',
    tag: '极简',
  },
  {
    emoji: '📈',
    title: '联合曲线交易',
    desc: '币在达到目标市值前，通过内置曲线交易。价格随买卖自动涨跌，透明公平。',
    gradient: 'linear-gradient(135deg, #7dd3fc, #67e8f9)',
    accent: '#67e8f9',
    glow: 'rgba(103, 232, 249, 0.4)',
    iconBg: 'rgba(103, 232, 249, 0.15)',
    tag: '透明',
  },
  {
    emoji: '🔄',
    title: '自动迁移 DEX',
    desc: '当市值达到目标，自动迁移到 PancakeSwap 开正式流动性，所有人都能交易。',
    gradient: 'linear-gradient(135deg, #34d399, #10b981)',
    accent: '#34d399',
    glow: 'rgba(52, 211, 153, 0.4)',
    iconBg: 'rgba(52, 211, 153, 0.15)',
    tag: '自动',
  },
  {
    emoji: '🌐',
    title: '4 条链支持',
    desc: 'BNB Chain · Ethereum · Robinhood · Circle Arc，一条链一个宇宙，随你选。',
    gradient: 'linear-gradient(135deg, #c4b5fd, #818cf8)',
    accent: '#c4b5fd',
    glow: 'rgba(196, 181, 253, 0.4)',
    iconBg: 'rgba(196, 181, 253, 0.15)',
    tag: '多链',
  },
  {
    emoji: '🔥',
    title: '永久销毁 LP',
    desc: '选择永久销毁，LP 直接烧掉。这是给买家的最强信任承诺，值得自豪地展示。',
    gradient: 'linear-gradient(135deg, #fb7185, #ef4444)',
    accent: '#fb7185',
    glow: 'rgba(251, 113, 133, 0.4)',
    iconBg: 'rgba(251, 113, 133, 0.15)',
    tag: '王牌',
  },
]

const STATS = [
  { label: '已发代币', value: '2,847', suffix: '', emoji: '🪙', color: '#fcd34d', trend: '+12.4%' },
  { label: '总交易额', value: '12.5',  suffix: 'BNB', emoji: '💰', color: '#d8b4fe', trend: '+8.7%' },
  { label: '锁仓总额', value: '856',   suffix: 'BNB', emoji: '🔒', color: '#67e8f9', trend: '+24.1%' },
  { label: '销毁 LP', value: '127',    suffix: '枚', emoji: '🔥', color: '#fb7185', trend: '+3.2%' },
]

export default function HomePage() {
  const { data: hotData } = useQuery({
    queryKey: ['home-hot'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/leaderboard?type=hot&limit=5`)
      if (!res.ok) return { entries: [] }
      return res.json()
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  return (
    <div className="space-y-24">
      {/* ============================================================
          🚀 HERO - 史诗级科技感
          ============================================================ */}
      <section className="relative pt-8 pb-4 overflow-hidden">
        {/* 背景辉光球 */}
        <div className="glow-orb glow-orb-banana w-[600px] h-[600px] -top-40 -left-40 opacity-60 animate-aurora"></div>
        <div className="glow-orb glow-orb-cat    w-[500px] h-[500px] top-20 right-0 opacity-50 animate-float-slow"></div>
        <div className="glow-orb glow-orb-pink   w-[400px] h-[400px] bottom-0 left-1/3 opacity-40 animate-float-reverse"></div>

        {/* 中心雷达扫描线 */}
        <div className="absolute inset-0 pointer-events-none opacity-30">
          <div className="absolute left-1/2 top-0 w-px h-40 bg-gradient-to-b from-transparent via-banana to-transparent"></div>
          <div className="absolute left-1/2 bottom-0 w-px h-40 bg-gradient-to-t from-transparent via-cat to-transparent"></div>
          <div className="absolute top-1/2 left-0 w-40 h-px bg-gradient-to-r from-transparent via-pink to-transparent"></div>
          <div className="absolute top-1/2 right-0 w-40 h-px bg-gradient-to-l from-transparent via-cyan to-transparent"></div>
        </div>

        <div className="relative text-center space-y-10 max-w-6xl mx-auto">
          {/* 顶部状态条 */}
          <div className="flex items-center justify-center gap-3 animate-slide-down">
            <div className="data-bar text-sm font-medium">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-400"></span>
              </span>
              <span className="text-secondary">所有系统在线</span>
              <span className="text-banana font-mono text-xs">v3.0</span>
              <span className="tag-warning text-[0.6rem] py-0.5">BETA</span>
            </div>
          </div>

          {/* 主标题 - 大字渐变 + 辉光 */}
          <div className="space-y-5 animate-fade-in">
            <div className="inline-flex items-center gap-2 text-sm font-mono text-muted">
              <span className="text-banana">┌─</span>
              <span>MEME LAUNCH PROTOCOL</span>
              <span className="text-cat">─┐</span>
            </div>

            <h1 className="font-display text-[clamp(3rem,9vw,6.5rem)] font-black tracking-tighter leading-[0.92]">
              <span className="block text-gradient-cosmic">香蕉猫</span>
              <span className="block text-gradient-banana glow-text">Meme 发射台</span>
            </h1>

            <p className="text-base sm:text-lg text-secondary max-w-2xl mx-auto leading-relaxed px-4">
              支持发币者自选 <span className="text-gradient-banana font-bold">LP 锁仓期限</span> 的多链代币发射平台。
              <br className="hidden sm:block" />
              选永久销毁？你的 LP 直接烧掉，谁都拿不走 —
              <span className="text-banana font-bold">这才是最诚实的项目</span>。
            </p>
          </div>

          {/* CTA 按钮组 */}
          <div className="flex flex-wrap justify-center gap-4 pt-2 animate-fade-in delay-200">
            <Link to="/create" className="btn-banana text-base group">
              <span className="text-xl group-hover:rotate-12 transition-transform duration-300">🍌</span>
              <span>开始发币</span>
              <span className="opacity-70 group-hover:translate-x-1 transition-transform">→</span>
            </Link>
            <Link to="/leaderboard" className="btn-cat text-base group">
              <span className="text-xl group-hover:scale-110 transition-transform">🏆</span>
              <span>排行榜</span>
            </Link>
            <Link to="/tokens" className="btn-glass text-base group">
              <span className="text-xl group-hover:scale-110 transition-transform">📋</span>
              <span>浏览代币</span>
            </Link>
          </div>

          {/* 统计数据 - 4 个高级玻璃卡 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 max-w-5xl mx-auto pt-6">
            {STATS.map((stat, i) => (
              <div
                key={stat.label}
                className="glass-premium rounded-2xl p-5 sm:p-6 text-left relative overflow-hidden group animate-slide-up"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                {/* 角落辉光 */}
                <div
                  className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-40 blur-2xl group-hover:opacity-80 transition-opacity duration-500"
                  style={{ background: stat.color }}
                ></div>

                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl animate-float" style={{ animationDelay: `${i * 0.5}s` }}>
                      {stat.emoji}
                    </span>
                    <span className="text-[0.65rem] font-mono text-green-400 font-semibold px-1.5 py-0.5 rounded-md bg-green-400/10">
                      ↑ {stat.trend}
                    </span>
                  </div>

                  <div className="font-display text-3xl sm:text-4xl font-black tracking-tighter mb-1"
                       style={{
                         color: stat.color,
                         textShadow: `0 0 24px ${stat.color}50, 0 0 60px ${stat.color}20`,
                       }}>
                    {stat.value}<span className="text-base sm:text-lg opacity-70 font-semibold ml-1">{stat.suffix}</span>
                  </div>

                  <div className="text-xs text-muted uppercase tracking-widest font-medium">
                    {stat.label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          🔥 当前热门
          ============================================================ */}
      {hotData && hotData.entries && hotData.entries.length > 0 && (
        <section className="max-w-5xl mx-auto animate-fade-in">
          <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
            <div>
              <div className="inline-flex items-center gap-2 mb-3">
                <span className="num-badge">LIVE</span>
                <span className="text-xs text-muted font-mono tracking-wider">REAL-TIME FEED</span>
              </div>
              <h2 className="font-display text-3xl sm:text-4xl font-black tracking-tight flex items-center gap-3">
                <span className="text-gradient-cosmic">🔥 当前热门</span>
                <span className="text-muted text-2xl font-display">/ Top 5</span>
              </h2>
              <p className="text-xs text-muted mt-2 font-mono">基于交易量和交易笔数综合排名 · 每分钟刷新</p>
            </div>
            <Link to="/leaderboard" className="btn-glass text-sm group">
              查看完整榜单
              <span className="opacity-70 group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>
          <div className="space-y-3">
            {hotData.entries.slice(0, 5).map((entry: any, i: number) => (
              <div key={`${entry.chainId}-${entry.address}`}
                   className="animate-slide-up"
                   style={{ animationDelay: `${i * 80}ms` }}>
                <TokenRow entry={entry} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ============================================================
          🔐 LP 锁仓说明 - 高级玻璃卡
          ============================================================ */}
      <section className="max-w-5xl mx-auto">
        <div className="glass-premium rounded-3xl p-8 sm:p-12 relative overflow-hidden">
          {/* 背景装饰 */}
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-50 blur-3xl animate-float-slow"
               style={{ background: 'radial-gradient(circle, rgba(252, 211, 77, 0.3), transparent 70%)' }}></div>
          <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full opacity-40 blur-3xl animate-float-reverse"
               style={{ background: 'radial-gradient(circle, rgba(183, 148, 246, 0.3), transparent 70%)' }}></div>

          {/* 网格底纹 */}
          <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
               style={{
                 backgroundImage: 'linear-gradient(rgba(252, 211, 77, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(252, 211, 77, 0.5) 1px, transparent 1px)',
                 backgroundSize: '40px 40px',
               }}></div>

          <div className="relative space-y-8">
            <div className="flex items-start gap-4">
              <div className="relative shrink-0">
                <div className="absolute inset-0 rounded-2xl blur-xl opacity-60"
                     style={{ background: 'radial-gradient(circle, rgba(252, 211, 77, 0.4), transparent 70%)' }}></div>
                <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
                     style={{
                       background: 'linear-gradient(135deg, rgba(252, 211, 77, 0.25), rgba(244, 114, 182, 0.15))',
                       border: '1px solid rgba(252, 211, 77, 0.4)',
                       boxShadow: '0 0 32px rgba(252, 211, 77, 0.25)',
                     }}>
                  🔐
                </div>
              </div>
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 mb-2">
                  <span className="tag-warning text-[0.6rem]">核心机制</span>
                  <span className="text-xs text-muted font-mono">/ LP LOCK</span>
                </div>
                <h2 className="font-display text-2xl sm:text-3xl font-black tracking-tight">
                  我们的独特之处：<span className="text-gradient-banana glow-text">LP 锁仓自选</span>
                </h2>
                <p className="text-sm text-secondary mt-2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                  防跑路机制 · 透明可验证
                </p>
              </div>
            </div>

            <p className="text-secondary leading-relaxed text-base">
              传统发射台（如 four.meme）没有锁仓机制，发币者可以随时撤走流动性跑路。
              香蕉猫让发币者在创建代币时就选择一个 <span className="text-banana font-bold">锁仓期限</span>，
              这是给买家的最强信任承诺。
            </p>

            {/* 锁仓期限矩阵 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { emoji: '⏰', text: '1 天',    desc: '基础信任，24小时观察期',   color: '#fcd34d', tier: '基础' },
                { emoji: '📅', text: '7 天',    desc: '中期项目，一周锁仓',       color: '#7dd3fc', tier: '中期' },
                { emoji: '🗓️', text: '30 天',   desc: '认真运营，一个月锁仓',     color: '#c4b5fd', tier: '长期' },
                { emoji: '🔒', text: '365 天',  desc: '长期项目，一年锁仓',       color: '#b794f6', tier: '长期' },
                { emoji: '🔥', text: '永久销毁', desc: 'LP 彻底烧毁，谁也拿不走', color: '#fb7185', tier: '王牌', highlight: true },
                { emoji: '⚠️', text: '无锁仓',  desc: '随时可取，风险最高',       color: '#94a3b8', tier: '危险' },
              ].map((item, i) => (
                <div
                  key={item.text}
                  className="glass-premium rounded-xl p-4 flex items-center gap-3 hover:scale-[1.03] transition-all duration-300 animate-slide-up group cursor-default"
                  style={{
                    animationDelay: `${i * 60}ms`,
                    ...(item.highlight ? {
                      borderColor: `${item.color}60`,
                      boxShadow: `0 0 40px ${item.color}30`,
                    } : {}),
                  }}
                >
                  <div className="relative">
                    <div className="absolute inset-0 rounded-xl blur-md opacity-60 group-hover:opacity-100 transition-opacity"
                         style={{ background: item.color }}></div>
                    <div className="relative w-11 h-11 rounded-xl flex items-center justify-center text-xl"
                         style={{
                           background: `${item.color}20`,
                           border: `1px solid ${item.color}40`,
                         }}>
                      {item.emoji}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <div className="font-bold text-sm truncate" style={{ color: item.color }}>
                        {item.text}
                      </div>
                      {item.highlight && <span className="tag-glow text-[0.55rem] shrink-0">推荐</span>}
                    </div>
                    <div className="text-xs text-muted truncate">{item.desc}</div>
                  </div>
                  <div className="text-[0.6rem] font-mono opacity-50 shrink-0">{item.tier}</div>
                </div>
              ))}
            </div>

            {/* 永久销毁说明 */}
            <div className="relative glass-strong rounded-xl p-5 overflow-hidden">
              <div className="absolute -top-12 -left-12 w-32 h-32 rounded-full opacity-40 blur-2xl"
                   style={{ background: 'radial-gradient(circle, rgba(252, 211, 77, 0.5), transparent 70%)' }}></div>
              <div className="relative flex items-start gap-3">
                <div className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                     style={{
                       background: 'rgba(252, 211, 77, 0.15)',
                       border: '1px solid rgba(252, 211, 77, 0.3)',
                     }}>
                  💡
                </div>
                <p className="text-sm text-secondary leading-relaxed">
                  <span className="text-banana font-bold">永久销毁</span> = LP 直接 burn，
                  包括发币者本人在内谁都取不出来。
                  这给买家传递了最强烈的「我不会跑路」信号。
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          ✨ 6 大特性卡片 - 高级版
          ============================================================ */}
      <section>
        <div className="text-center mb-12 animate-fade-in">
          <div className="inline-flex items-center gap-2 mb-4">
            <span className="text-xs font-mono text-muted tracking-widest">[ CORE FEATURES ]</span>
          </div>
          <h2 className="font-display text-4xl sm:text-5xl font-black tracking-tighter mb-3">
            为什么选 <span className="text-gradient-banana glow-text">香蕉猫</span>？🍌
          </h2>
          <p className="text-muted text-sm max-w-md mx-auto">六大核心特性，打造最受信赖的 Meme 发射台</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((feature, i) => (
            <div
              key={feature.title}
              className="glass-premium rounded-2xl p-6 sm:p-7 group cursor-pointer animate-slide-up relative overflow-hidden"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              {/* 角落辉光 */}
              <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-0 group-hover:opacity-60 blur-3xl transition-opacity duration-700"
                   style={{ background: feature.gradient }}></div>

              {/* 网格底纹 */}
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                   style={{
                     backgroundImage: `linear-gradient(${feature.accent} 1px, transparent 1px), linear-gradient(90deg, ${feature.accent} 1px, transparent 1px)`,
                     backgroundSize: '32px 32px',
                   }}></div>

              <div className="relative">
                {/* Tag */}
                <div className="flex items-center justify-between mb-5">
                  <span className="text-[0.6rem] font-mono px-2 py-0.5 rounded-md uppercase tracking-wider"
                        style={{
                          background: feature.iconBg,
                          color: feature.accent,
                          border: `1px solid ${feature.accent}40`,
                        }}>
                    {feature.tag}
                  </span>
                  <span className="font-orbitron text-[0.65rem] text-muted opacity-50">
                    0{i + 1}
                  </span>
                </div>

                {/* Emoji 图标 */}
                <div className="relative w-16 h-16 mb-5">
                  <div className="absolute inset-0 rounded-2xl blur-xl opacity-60 group-hover:opacity-100 transition-opacity duration-500"
                       style={{ background: feature.gradient }}></div>
                  <div className="relative w-full h-full rounded-2xl flex items-center justify-center text-3xl transition-all duration-500 group-hover:scale-110 group-hover:-rotate-6"
                       style={{
                         background: feature.gradient,
                         boxShadow: `0 12px 32px ${feature.glow}`,
                       }}>
                    <span className="drop-shadow-lg">{feature.emoji}</span>
                  </div>
                </div>

                {/* 标题 + 描述 */}
                <h3 className="font-display text-lg font-bold mb-2 tracking-tight group-hover:text-banana transition-colors">
                  {feature.title}
                </h3>
                <p className="text-sm text-secondary leading-relaxed">
                  {feature.desc}
                </p>

                {/* 底部装饰线 */}
                <div className="mt-5 h-0.5 rounded-full overflow-hidden bg-white/5">
                  <div className="h-full w-1/3 rounded-full transition-all duration-700 group-hover:w-full"
                       style={{ background: feature.gradient }}></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ============================================================
          🌐 支持的区块链 - 高级版
          ============================================================ */}
      <section className="max-w-6xl mx-auto">
        <div className="text-center mb-10 animate-fade-in">
          <div className="inline-flex items-center gap-2 mb-3">
            <span className="text-xs font-mono text-muted tracking-widest">[ BLOCKCHAINS ]</span>
          </div>
          <h2 className="font-display text-4xl sm:text-5xl font-black tracking-tighter mb-3">
            <span className="text-gradient-aurora">🌐 支持的区块链</span>
          </h2>
          <p className="text-muted text-sm">一条链一个宇宙，随你选择</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Object.values(CHAINS).map((chain, i) => (
            <div
              key={chain.id}
              className="glass-premium rounded-2xl p-5 sm:p-6 text-center group hover:scale-[1.05] transition-all duration-500 animate-slide-up relative overflow-hidden"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              {/* 角落辉光 */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-2xl"
                   style={{ background: 'radial-gradient(circle at center, rgba(252, 211, 77, 0.2), transparent 70%)' }}></div>

              <div className="relative">
                <div className="text-5xl mb-4 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-500 inline-block">
                  {chain.emoji}
                </div>
                <div className="font-display font-bold text-base mb-1 tracking-tight">{chain.nameCn}</div>
                <div className="text-xs text-banana mb-3 font-mono">{chain.nativeCurrency.symbol}</div>
                <div className="inline-flex items-center gap-1.5 text-[0.65rem] font-mono text-muted px-2 py-0.5 rounded-md bg-white/5 border border-white/5">
                  <span className="w-1 h-1 rounded-full bg-green-400 animate-pulse"></span>
                  Chain #{chain.id}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 底部装饰条 */}
          <div className="mt-10 glass rounded-2xl p-4 flex items-center justify-center gap-4 text-sm text-muted flex-wrap">
          <span className="font-mono tracking-wider">支持</span>
          <span className="font-bold text-secondary">BNB Chain</span>
          <span>·</span>
          <span className="font-bold text-secondary">Ethereum</span>
          <span>·</span>
          <span className="font-bold text-secondary">Robinhood</span>
          <span>·</span>
          <span className="font-bold text-secondary">Circle Arc</span>
          <span className="tag-warning text-[0.6rem]">测试网 Beta · 请勿投入真实资产</span>
        </div>
      </section>

      {/* ============================================================
          💎 信任承诺三连
          ============================================================ */}
      <section className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { emoji: '🔒', title: '链上可验证', desc: '所有 LP 锁定与销毁都在链上,任何人可查', color: '#7dd3fc' },
            { emoji: '⚡', title: '3 分钟发币', desc: '填资料、设锁仓、点确认,3 分钟即可上链', color: '#fcd34d' },
            { emoji: '🌍', title: '14 种语言', desc: '从英语到中文,从日语到阿拉伯语,无门槛', color: '#c4b5fd' },
          ].map((item, i) => (
            <div key={item.title}
                 className="glass-premium rounded-2xl p-6 group hover:scale-[1.03] transition-all relative overflow-hidden animate-slide-up"
                 style={{ animationDelay: `${i * 100}ms` }}>
              <div className="absolute -top-16 -right-16 w-32 h-32 rounded-full opacity-30 blur-2xl group-hover:opacity-80 transition-opacity"
                   style={{ background: item.color }}></div>
              <div className="relative">
                <div className="text-4xl mb-3 group-hover:scale-110 transition-transform inline-block">{item.emoji}</div>
                <h3 className="font-display text-lg font-black mb-2" style={{ color: item.color }}>{item.title}</h3>
                <p className="text-sm text-secondary leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ============================================================
          🚀 底部 CTA
          ============================================================ */}
      <section className="max-w-6xl mx-auto">
        <div className="glass-premium rounded-3xl p-8 sm:p-12 text-center relative overflow-hidden">
          <div className="absolute -top-32 left-1/4 w-72 h-72 rounded-full opacity-30 blur-3xl animate-float-slow"
               style={{ background: 'radial-gradient(circle, rgba(252, 211, 77, 0.5), transparent 70%)' }}></div>
          <div className="absolute -bottom-32 right-1/4 w-72 h-72 rounded-full opacity-30 blur-3xl animate-float-reverse"
               style={{ background: 'radial-gradient(circle, rgba(183, 148, 246, 0.5), transparent 70%)' }}></div>
          <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
               style={{
                 backgroundImage: 'linear-gradient(rgba(252, 211, 77, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(252, 211, 77, 0.5) 1px, transparent 1px)',
                 backgroundSize: '40px 40px',
               }}></div>

          <div className="relative space-y-6">
            <div className="inline-flex items-center gap-2 mb-2">
              <span className="text-xs font-mono text-muted tracking-widest">[ READY TO LAUNCH ]</span>
            </div>
            <h2 className="font-display text-3xl sm:text-5xl font-black tracking-tighter leading-tight">
              准备好发射你的<br />
              <span className="text-gradient-banana glow-text">下一个百倍 Meme 币？</span>
            </h2>
            <p className="text-sm sm:text-base text-secondary max-w-xl mx-auto leading-relaxed">
              香蕉猫发射台让发币者自选 LP 锁仓期限,给买家最强信任承诺。<br className="hidden sm:block" />
              从创建到上链只需 3 分钟,无需写代码。
            </p>
            <div className="flex flex-wrap justify-center gap-4 pt-4">
              <Link to="/create" className="btn-banana text-base group">
                <span className="text-xl group-hover:rotate-12 transition-transform duration-300">🍌</span>
                <span>立即发币</span>
                <span className="opacity-70 group-hover:translate-x-1 transition-transform">→</span>
              </Link>
              <Link to="/docs" className="btn-glass text-base group">
                <span className="text-xl">📖</span>
                <span>阅读文档</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
