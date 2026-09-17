import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Area, AreaChart,
} from 'recharts'
import { PageHero, Section, CompactCard, EmptyState, StatusPill, StatBadge } from '../components/UI'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const LABEL_NAMES: Record<number, string> = {
  0: 'MEME', 1: 'AI', 2: 'DeFi', 3: 'GAMEFI', 4: 'SOCIAL', 5: 'INFRA', 6: 'OTHER',
}

const LABEL_COLORS = ['#fcd34d', '#b794f6', '#7dd3fc', '#34d399', '#f472b6', '#facc15', '#6b7280']

const CHAIN_NAMES: Record<number, string> = {
  97: '🔶 BSC', 11155111: '🔷 ETH', 46630: '🟢 Robinhood', 5042002: '🌊 Arc',
}

const CHART_TOOLTIP_STYLE = {
  backgroundColor: 'rgba(4, 4, 12, 0.85)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(252, 211, 77, 0.3)',
  borderRadius: '0.75rem',
  fontSize: '0.75rem',
  color: '#f5f6ff',
}

export default function DashboardPage() {
  const { data: overview } = useQuery({
    queryKey: ['stats-overview'],
    queryFn: () => fetch(`${API_BASE}/api/stats/overview`).then(r => r.json()),
    refetchInterval: 30_000,
  })

  const { data: timeseries } = useQuery({
    queryKey: ['stats-timeseries'],
    queryFn: () => fetch(`${API_BASE}/api/stats/timeseries?days=14`).then(r => r.json()),
    refetchInterval: 60_000,
  })

  const { data: categories } = useQuery({
    queryKey: ['stats-categories'],
    queryFn: () => fetch(`${API_BASE}/api/stats/by-category`).then(r => r.json()),
    refetchInterval: 60_000,
  })

  const { data: topTokens } = useQuery({
    queryKey: ['stats-top-volume'],
    queryFn: () => fetch(`${API_BASE}/api/stats/top-tokens?sortBy=volume`).then(r => r.json()),
    refetchInterval: 30_000,
  })

  const { data: byChain } = useQuery({
    queryKey: ['stats-chain'],
    queryFn: () => fetch(`${API_BASE}/api/stats/by-chain`).then(r => r.json()),
    refetchInterval: 60_000,
  })

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHero
        icon="📊"
        title={<>数据<span className="text-gradient-aurora">分析</span></>}
        subtitle="实时统计 · 趋势分析 · 热门排行"
        badge={<StatBadge color="#b794f6">DASHBOARD v3</StatBadge>}
      />

      {/* 总览卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        <StatCard icon="🍌" label="总代币数" value={overview?.total_tokens ?? 0} accent="yellow" />
        <StatCard icon="🎓" label="已毕业" value={overview?.graduated_tokens ?? 0} accent="green" sub={`${overview?.graduations_24h ?? 0} 个 24h 内`} />
        <StatCard icon="🆕" label="新增 24h" value={overview?.new_tokens_24h ?? 0} accent="blue" />
        <StatCard icon="💰" label="总交易量" value={formatBig(overview?.total_volume)} accent="purple" sub={`24h: ${formatBig(overview?.volume_24h)}`} />
        <StatCard icon="📈" label="交易笔数 24h" value={overview?.trades_24h ?? 0} accent="cyan" />
        <StatCard icon="🔥" label="永久锁仓" value={overview?.permanent_locks ?? 0} accent="red" />
      </div>

      {/* 增长曲线 */}
      <Section icon="📈" title="代币增长趋势" subtitle="过去 14 天 · 新增代币 / 毕业事件" index={0}>
        <div className="h-64">
          {timeseries?.series && timeseries.series.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeseries.series}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fcd34d" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#fcd34d" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="day"
                  tickFormatter={(d) => new Date(d).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
                  tick={{ fill: '#7d83a3', fontSize: 10 }}
                  stroke="rgba(255,255,255,0.08)"
                />
                <YAxis tick={{ fill: '#7d83a3', fontSize: 10 }} stroke="rgba(255,255,255,0.08)" />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: '0.75rem', color: '#7d83a3' }} />
                <Area type="monotone" dataKey="new_tokens" stroke="#fcd34d" strokeWidth={2} fill="url(#g1)" name="新增代币" />
                <Area type="monotone" dataKey="graduations" stroke="#34d399" strokeWidth={2} fill="url(#g2)" name="毕业" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-muted">暂无数据</div>
          )}
        </div>
      </Section>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* 分类分布 */}
        <Section icon="🏷️" title="分类分布" subtitle="代币分类占比" index={1}>
          {categories?.categories && categories.categories.length > 0 ? (
            <>
              <div className="h-56">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={categories.categories} dataKey="count" nameKey="label"
                      cx="50%" cy="50%" innerRadius={50} outerRadius={85}
                      paddingAngle={3}
                      label={(p) => LABEL_NAMES[p.label] ?? p.label}>
                      {categories.categories.map((_: any, i: number) => (
                        <Cell key={i} fill={LABEL_COLORS[i % LABEL_COLORS.length]} stroke="rgba(4,4,12,0.4)" />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      formatter={(v: any, _: any, props: any) => [v, LABEL_NAMES[props.payload.label]]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4">
                {categories.categories.map((c: any, i: number) => (
                  <div key={c.label} className="glass rounded-xl p-2.5 flex items-center gap-2 text-xs">
                    <span className="w-3 h-3 rounded shrink-0" style={{ backgroundColor: LABEL_COLORS[i % LABEL_COLORS.length] }} />
                    <span className="font-bold">{LABEL_NAMES[c.label] || `L${c.label}`}</span>
                    <span className="text-muted ml-auto font-mono">{c.count}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState emoji="📊" title="暂无分类数据" />
          )}
        </Section>

        {/* 链分布 */}
        <Section icon="🌐" title="链分布" subtitle="各链代币数量" index={2}>
          {byChain?.chains && byChain.chains.length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={byChain.chains}>
                  <XAxis dataKey="chain_id" tickFormatter={(v) => CHAIN_NAMES[v] || `Chain ${v}`}
                    tick={{ fill: '#7d83a3', fontSize: 11 }} stroke="rgba(255,255,255,0.08)" />
                  <YAxis tick={{ fill: '#7d83a3', fontSize: 10 }} stroke="rgba(255,255,255,0.08)" />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    labelFormatter={(v) => CHAIN_NAMES[v as number] || v}
                  />
                  <Bar dataKey="tokens" fill="#fcd34d" radius={[6, 6, 0, 0]}>
                    {byChain.chains.map((_: any, i: number) => (
                      <Cell key={i} fill={['#fcd34d', '#b794f6', '#7dd3fc', '#34d399'][i % 4]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState emoji="🌐" title="暂无链数据" />}
        </Section>
      </div>

      {/* 热门代币 */}
      <Section
        icon="🔥"
        title="热门代币"
        subtitle="按交易量排序 · 每 30 秒刷新"
        index={3}
        badge={<StatusPill variant="success" pulse>LIVE</StatusPill>}
      >
        {topTokens?.tokens && topTokens.tokens.length > 0 ? (
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="text-xs text-muted uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-2 text-left">#</th>
                  <th className="py-3 px-2 text-left">代币</th>
                  <th className="py-3 px-2 text-left">分类</th>
                  <th className="py-3 px-2 text-left">链</th>
                  <th className="py-3 px-2 text-right">总交易量</th>
                  <th className="py-3 px-2 text-right">交易笔数</th>
                  <th className="py-3 px-2 text-right">状态</th>
                </tr>
              </thead>
              <tbody>
                {topTokens.tokens.slice(0, 10).map((t: any, i: number) => (
                  <tr key={t.address} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="py-3 px-2">
                      <span className="font-orbitron text-muted">{String(i + 1).padStart(2, '0')}</span>
                    </td>
                    <td className="py-3 px-2">
                      <Link to={`/token/${t.address}`} className="group-hover:text-banana transition-colors">
                        <div className="font-bold">{t.symbol}</div>
                        <div className="text-xs text-muted">{t.name}</div>
                      </Link>
                    </td>
                    <td className="py-3 px-2">
                      <StatusPill variant="info">{LABEL_NAMES[t.label] || `L${t.label}`}</StatusPill>
                    </td>
                    <td className="py-3 px-2 text-xs">{CHAIN_NAMES[t.chain_id] || t.chain_id}</td>
                    <td className="py-3 px-2 text-right">
                      <span className="font-mono text-banana font-bold">{formatBig(t.total_volume)}</span>
                    </td>
                    <td className="py-3 px-2 text-right text-muted font-mono">{t.total_trades}</td>
                    <td className="py-3 px-2 text-right">
                      {t.graduated_at
                        ? <StatusPill variant="success">🎓 已毕业</StatusPill>
                        : <StatusPill variant="warning">🚀 曲线中</StatusPill>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState emoji="🍌" title="暂无热门代币" />}
      </Section>
    </div>
  )
}

function StatCard({ icon, label, value, sub, accent }: any) {
  const config: Record<string, { gradient: string; border: string; text: string; glow: string }> = {
    yellow: { gradient: 'from-yellow-500/15 to-orange-500/5', border: 'rgba(252, 211, 77, 0.25)',  text: '#fcd34d', glow: 'rgba(252, 211, 77, 0.35)' },
    green:  { gradient: 'from-green-500/15 to-emerald-500/5',  border: 'rgba(52, 211, 153, 0.25)',  text: '#34d399', glow: 'rgba(52, 211, 153, 0.35)' },
    blue:   { gradient: 'from-blue-500/15 to-cyan-500/5',       border: 'rgba(125, 211, 252, 0.25)', text: '#7dd3fc', glow: 'rgba(125, 211, 252, 0.35)' },
    purple: { gradient: 'from-purple-500/15 to-pink-500/5',     border: 'rgba(183, 148, 246, 0.25)', text: '#b794f6', glow: 'rgba(183, 148, 246, 0.35)' },
    cyan:   { gradient: 'from-cyan-500/15 to-blue-500/5',       border: 'rgba(103, 232, 249, 0.25)', text: '#67e8f9', glow: 'rgba(103, 232, 249, 0.35)' },
    red:    { gradient: 'from-red-500/15 to-rose-500/5',         border: 'rgba(251, 113, 133, 0.25)', text: '#fb7185', glow: 'rgba(251, 113, 133, 0.35)' },
  }
  const c = config[accent] || config.yellow
  return (
    <div
      className="rounded-2xl p-4 sm:p-5 relative overflow-hidden transition-all duration-300 hover:-translate-y-1 group"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
        border: `1px solid ${c.border}`,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: `0 8px 32px rgba(0,0,0,0.3)`,
      }}
    >
      <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-30 blur-3xl group-hover:opacity-50 transition-opacity"
        style={{ background: c.glow }}></div>
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <span className="text-2xl">{icon}</span>
        </div>
        <div className="text-2xl sm:text-3xl font-black font-orbitron tracking-tight" style={{ color: c.text }}>
          {value}
        </div>
        <div className="text-xs text-muted mt-1 uppercase tracking-wider">{label}</div>
        {sub && <div className="text-xs text-muted/70 mt-1.5 font-mono">{sub}</div>}
      </div>
    </div>
  )
}

function formatBig(v: any): string {
  if (v === undefined || v === null || v === '0') return '0'
  const n = Number(BigInt(typeof v === 'string' ? v : '0') / BigInt(10 ** 14)) / 10000
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(2) + 'K'
  return n.toFixed(2)
}
