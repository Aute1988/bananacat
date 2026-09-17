import { Outlet, Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useWallet } from '../hooks/useWallet'
import LanguageSwitcher from './LanguageSwitcher'
import ThemeToggle from './ThemeToggle'
import ChainSelector from './ChainSelector'

// 渲染标记：第一次 mount 到屏幕时打 console.log，方便远程诊断。
// 如果你看不到这条 log，说明 React tree 在到达 Layout 之前就崩了
// (通常是被 ErrorBoundary 兜住，红色 banner 会显示具体原因)。
if (typeof window !== 'undefined') {
  // 用 queueMicrotask 避开 StrictMode 双调用的干扰，只在第一次挂载时记一次
  if (!(window as unknown as { __BANANA_MOUNTED__?: boolean }).__BANANA_MOUNTED__) {
    ;(window as unknown as { __BANANA_MOUNTED__?: boolean }).__BANANA_MOUNTED__ = true
    // eslint-disable-next-line no-console
    console.log('🍌🐱 Layout mounted — banana site is alive!')
  }
}

export default function Layout() {
  const location = useLocation()
  const { t } = useTranslation()

  const NAV_LINKS = [
    { to: '/', label: t('nav.home'), icon: '🏠' },
    { to: '/create', label: t('nav.create'), icon: '🍌' },
    { to: '/leaderboard', label: t('nav.leaderboard'), icon: '🏆' },
    { to: '/tokens', label: t('nav.tokens'), icon: '📋' },
    { to: '/my-tokens', label: t('nav.myTokens'), icon: '👤' },
    { to: '/dashboard', label: t('nav.dashboard'), icon: '📊' },
    { to: '/notifications', label: '通知', icon: '🔔' },
    { to: '/docs', label: t('docs.title'), icon: '📖' },
  ]

  return (
    <div className="min-h-screen relative flex flex-col">
      {/* ============================================================
          🧭 顶部导航栏 - 高级玻璃 + 底部辉光线
          ============================================================ */}
      <nav className="sticky top-0 z-50 animate-slide-down">
        {/* 背景层 */}
        <div className="absolute inset-0 glass-strong"
             style={{
               background: 'rgba(4, 4, 12, 0.75)',
               backdropFilter: 'blur(32px) saturate(200%)',
               WebkitBackdropFilter: 'blur(32px) saturate(200%)',
             }}></div>

        {/* 底部辉光线(调低亮度防伤眼) */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-banana/25 to-transparent"></div>

        {/* 顶部高光线 */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

        <div className="relative max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="relative">
              <div className="absolute inset-0 rounded-xl blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                   style={{ background: 'radial-gradient(circle, rgba(252, 211, 77, 0.6), transparent 70%)' }}></div>
              <span className="relative text-2xl group-hover:rotate-12 transition-transform duration-500">🍌🐱</span>
            </div>
            <span className="font-display font-bold text-base sm:text-lg text-gradient-banana hidden sm:block tracking-tight">
              {t('app.title').replace('🍌🐱 ', '')}
            </span>
          </Link>

          {/* 导航 */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {NAV_LINKS.map(link => {
              const active = location.pathname === link.to
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`relative px-3.5 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap flex items-center gap-1.5 group ${
                    active
                      ? 'text-banana'
                      : 'text-secondary hover:text-primary'
                  }`}
                  style={active ? {
                    background: 'linear-gradient(135deg, rgba(252, 211, 77, 0.15), rgba(244, 114, 182, 0.08))',
                    border: '1px solid rgba(252, 211, 77, 0.35)',
                    boxShadow: '0 0 20px rgba(252, 211, 77, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                  } : {
                    border: '1px solid transparent',
                  }}
                >
                  {/* Hover 背景 */}
                  {!active && (
                    <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                         style={{
                           background: 'rgba(255, 255, 255, 0.04)',
                           border: '1px solid rgba(255, 255, 255, 0.08)',
                         }}></div>
                  )}
                  {/* Active 顶部高光线(减弱亮度防伤眼) */}
                  {active && (
                    <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-banana/40 to-transparent"></div>
                  )}
                  <span className="relative text-xs">{link.icon}</span>
                  <span className="relative">{link.label}</span>
                </Link>
              )
            })}
          </div>

          {/* 右侧:语言 + 主题 + 链选择 + 钱包 */}
          <div className="flex items-center gap-2 shrink-0">
            <LanguageSwitcher />
            <ThemeToggle />
            <ChainSelector />
            <ConnectButton
              accountStatus="address"
              chainStatus="icon"
              showBalance={false}
            />
          </div>
        </div>
      </nav>

      {/* 主内容 */}
      <main className="relative flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 z-10 w-full">
        <Outlet />
      </main>

      {/* ============================================================
          🦶 Footer - 多列精致版（品牌/产品/社区/法律/订阅/社媒）
          ============================================================ */}
      <footer className="relative z-10 mt-12 sm:mt-20">
        {/* 顶部辉光线(减弱防伤眼) */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-banana/20 to-transparent"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-8">
          {/* CTA 卡片 - 行动召唤 */}
          <div className="glass-premium rounded-3xl p-8 sm:p-12 mb-10 relative overflow-hidden">
            <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-30 blur-3xl animate-float-slow"
                 style={{ background: 'radial-gradient(circle, rgba(252, 211, 77, 0.5), transparent 70%)' }}></div>
            <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full opacity-30 blur-3xl animate-float-reverse"
                 style={{ background: 'radial-gradient(circle, rgba(183, 148, 246, 0.5), transparent 70%)' }}></div>
            <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
                 style={{
                   backgroundImage: 'linear-gradient(rgba(252, 211, 77, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(252, 211, 77, 0.5) 1px, transparent 1px)',
                   backgroundSize: '40px 40px',
                 }}></div>

            <div className="relative grid lg:grid-cols-2 gap-8 items-center">
              <div>
                <div className="inline-flex items-center gap-2 mb-4">
                  <span className="text-xs font-mono text-muted tracking-widest">[ READY TO LAUNCH? ]</span>
                  <span className="tag-warning text-[0.6rem]">BETA</span>
                </div>
                <h3 className="font-display text-3xl sm:text-4xl font-black tracking-tighter leading-tight mb-3">
                  准备好发射你的
                  <br />
                  <span className="text-gradient-banana glow-text">下一个百倍 Meme 币？</span>
                </h3>
                <p className="text-sm text-secondary leading-relaxed max-w-md">
                  香蕉猫发射台让发币者自选 LP 锁仓期限，给买家最强信任承诺。从创建到上链只需 3 分钟。
                </p>
              </div>
              <div className="flex flex-col sm:flex-row lg:justify-end gap-3">
                <Link to="/create" className="btn-banana text-base group">
                  <span className="text-xl group-hover:rotate-12 transition-transform">🍌</span>
                  <span>立即发币</span>
                  <span className="opacity-70 group-hover:translate-x-1 transition-transform">→</span>
                </Link>
                <Link to="/leaderboard" className="btn-glass text-base group">
                  <span className="text-xl group-hover:scale-110 transition-transform">🏆</span>
                  <span>查看排行</span>
                </Link>
              </div>
            </div>
          </div>

          {/* 主 Footer 内容 - 5 列 */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 sm:gap-10 mb-10">
            {/* 品牌列 */}
            <div className="col-span-2 md:col-span-3 lg:col-span-1 space-y-4">
              <Link to="/" className="flex items-center gap-2.5 group">
                <div className="relative">
                  <div className="absolute inset-0 rounded-xl blur-md opacity-0 group-hover:opacity-100 transition-opacity"
                       style={{ background: 'radial-gradient(circle, rgba(252, 211, 77, 0.6), transparent 70%)' }}></div>
                  <span className="relative text-2xl">🍌🐱</span>
                </div>
                <span className="font-display font-bold text-base text-gradient-banana tracking-tight">
                  香蕉猫发射台
                </span>
              </Link>
              <p className="text-xs text-secondary leading-relaxed max-w-xs">
                多链 Meme 代币发射平台。支持发币者自选 LP 锁仓期限,给买家最强信任承诺。
              </p>

              {/* 社媒图标 */}
              <div className="flex items-center gap-2 pt-2">
                {[
                  { name: 'Twitter / X', icon: '𝕏', href: 'https://twitter.com', color: '#1da1f2' },
                  { name: 'Discord',     icon: '💬', href: 'https://discord.gg', color: '#5865f2' },
                  { name: 'Telegram',    icon: '✈️', href: 'https://t.me', color: '#26a5e4' },
                  { name: 'GitHub',      icon: '⌨️', href: 'https://github.com', color: '#a1a1aa' },
                ].map(s => (
                  <a
                    key={s.name}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.name}
                    className="w-9 h-9 rounded-xl flex items-center justify-center glass hover:scale-110 transition-all group"
                  >
                    <span className="text-base group-hover:scale-110 transition-transform">{s.icon}</span>
                  </a>
                ))}
              </div>
            </div>

            {/* 产品 */}
            <div>
              <h4 className="font-display text-xs font-bold uppercase tracking-widest text-muted mb-4 flex items-center gap-2">
                <span className="w-1 h-3 rounded-full bg-banana"></span>
                产品
              </h4>
              <ul className="space-y-2.5 text-sm">
                {[
                  { to: '/create', label: '发币' },
                  { to: '/tokens', label: '代币列表' },
                  { to: '/leaderboard', label: '排行榜' },
                  { to: '/my-tokens', label: '我的代币' },
                  { to: '/dashboard', label: '数据分析' },
                ].map(l => (
                  <li key={l.to}>
                    <Link to={l.to} className="text-secondary hover:text-banana transition-colors flex items-center gap-1.5 group">
                      <span className="w-1 h-1 rounded-full bg-muted group-hover:bg-banana transition-colors"></span>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* 开发者 */}
            <div>
              <h4 className="font-display text-xs font-bold uppercase tracking-widest text-muted mb-4 flex items-center gap-2">
                <span className="w-1 h-3 rounded-full bg-cat"></span>
                开发者
              </h4>
              <ul className="space-y-2.5 text-sm">
                {[
                  { to: '/docs',         label: '使用文档' },
                  { to: '/notifications', label: '通知订阅' },
                  { href: 'https://github.com',  label: 'GitHub 仓库', ext: true },
                  { href: 'https://twitter.com',  label: 'Twitter', ext: true },
                  { href: 'https://discord.gg',   label: 'Discord 社区', ext: true },
                ].map((l, i) => (
                  <li key={i}>
                    {l.ext ? (
                      <a href={l.href} target="_blank" rel="noopener noreferrer"
                         className="text-secondary hover:text-cat transition-colors flex items-center gap-1.5 group">
                        <span className="w-1 h-1 rounded-full bg-muted group-hover:bg-cat transition-colors"></span>
                        {l.label}
                        <span className="text-[0.55rem] opacity-50">↗</span>
                      </a>
                    ) : (
                      <Link to={l.to!} className="text-secondary hover:text-cat transition-colors flex items-center gap-1.5 group">
                        <span className="w-1 h-1 rounded-full bg-muted group-hover:bg-cat transition-colors"></span>
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* 社区 */}
            <div>
              <h4 className="font-display text-xs font-bold uppercase tracking-widest text-muted mb-4 flex items-center gap-2">
                <span className="w-1 h-3 rounded-full bg-pink-400"></span>
                社区
              </h4>
              <ul className="space-y-2.5 text-sm">
                {[
                  { href: 'https://discord.gg',     label: 'Discord', desc: '2.4k 成员' },
                  { href: 'https://t.me',           label: 'Telegram', desc: '1.8k 订阅' },
                  { href: 'https://twitter.com',    label: 'Twitter / X', desc: '5.1k 粉丝' },
                  { href: 'https://github.com',     label: 'GitHub', desc: '开源仓库' },
                ].map((l, i) => (
                  <li key={i}>
                    <a href={l.href} target="_blank" rel="noopener noreferrer"
                       className="text-secondary hover:text-pink-400 transition-colors flex items-center justify-between gap-2 group">
                      <span className="flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-muted group-hover:bg-pink-400 transition-colors"></span>
                        {l.label}
                      </span>
                      <span className="text-[0.6rem] text-muted font-mono opacity-60 group-hover:opacity-100 transition-opacity">
                        {l.desc}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* 法律 */}
            <div>
              <h4 className="font-display text-xs font-bold uppercase tracking-widest text-muted mb-4 flex items-center gap-2">
                <span className="w-1 h-3 rounded-full bg-cyan-400"></span>
                法律
              </h4>
              <ul className="space-y-2.5 text-sm">
                {[
                  { label: '服务条款', href: '#' },
                  { label: '隐私政策', href: '#' },
                  { label: '免责声明', href: '#' },
                  { label: 'Cookie 设置', href: '#' },
                  { label: '联系支持', href: 'mailto:support@banana-cat.io' },
                ].map((l, i) => (
                  <li key={i}>
                    <a href={l.href}
                       className="text-secondary hover:text-cyan-400 transition-colors flex items-center gap-1.5 group">
                      <span className="w-1 h-1 rounded-full bg-muted group-hover:bg-cyan-400 transition-colors"></span>
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* 状态栏 */}
          <div className="glass rounded-2xl p-4 mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 sm:gap-5 text-xs">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400"></span>
                </span>
                <span className="text-secondary font-mono">所有系统在线</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted">
                <span>🟢 BNB Testnet</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted">
                <span>🟢 Sepolia</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted">
                <span>🟢 Robinhood</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted">
                <span>🟢 Circle Arc</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[0.6rem] font-mono">
              <span className="text-banana">v3.0.0</span>
              <span className="text-muted">·</span>
              <span className="tag-warning">BETA</span>
            </div>
          </div>

          {/* 版权 + 免责声明 */}
          <div className="border-t border-white/5 pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-xs text-muted">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono">© 2026 Banana Cat Labs.</span>
              <span className="opacity-50">|</span>
              <span>🍌🐱 香蕉猫发射台 · 所有权利保留</span>
            </div>
            <div className="flex items-center gap-3 text-[0.65rem] flex-wrap">
              <span className="font-mono">Made with 🍌 in Testnet</span>
              <span className="opacity-50">·</span>
              <span className="text-yellow-400/70">⚠️ 测试网 Beta · 请勿投入真实资产</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
