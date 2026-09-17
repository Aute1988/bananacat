import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageHero, Section, EmptyState, StatusPill, OptionGrid, Field, StatBadge, InfoBadge, toast } from '../components/UI'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface Subscription {
  id: number
  event_type: string
  target_type: 'discord' | 'telegram'
  target_url: string
  chain_id: number | null
  enabled: boolean
}

interface NotificationHistory {
  id: number
  event_type: string
  target_type: string
  status: string
  error_message: string | null
  sent_at: string
}

const EVENT_TYPES = [
  { value: 'new_token',   label: '🍌 新代币创建',     color: '#fcd34d' },
  { value: 'graduation',  label: '🎓 代币毕业',       color: '#34d399' },
  { value: 'large_trade', label: '💰 大额交易',       color: '#7dd3fc' },
  { value: 'lock_burn',   label: '🔥 LP 销毁(强信任)', color: '#fb7185' },
]

const EVENT_LABELS: Record<string, string> = {
  new_token: '新代币', graduation: '毕业', large_trade: '大额交易', lock_burn: '销毁',
}

const PLATFORMS = [
  { value: 'discord',  label: '🟣 Discord', desc: 'Webhook 直接推送', color: '#a78bfa' },
  { value: 'telegram', label: '✈️ Telegram', desc: 'Bot 推送到群组', color: '#60a5fa' },
] as const

export default function NotificationsPage() {
  const [eventType, setEventType] = useState('new_token')
  const [targetType, setTargetType] = useState<'discord' | 'telegram'>('discord')
  const [targetUrl, setTargetUrl] = useState('')
  const [chainId, setChainId] = useState<string>('')

  const queryClient = useQueryClient()

  const { data: subs = [] } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/notifications/subscriptions`)
      if (!res.ok) return []
      const data = await res.json()
      return data.subscriptions as Subscription[]
    },
  })

  const { data: history = [] } = useQuery({
    queryKey: ['notifHistory'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/notifications/history?limit=20`)
      if (!res.ok) return []
      const data = await res.json()
      return data.history as NotificationHistory[]
    },
  })

  const subscribe = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/api/notifications/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: eventType,
          target_type: targetType,
          target_url: targetUrl,
          chain_id: chainId ? Number(chainId) : null,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      setTargetUrl('')
      toast('订阅成功!', 'success')
    },
    onError: (err: any) => toast(err.message || '订阅失败', 'error'),
  })

  const unsubscribe = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API_BASE}/api/notifications/subscriptions/${id}`, { method: 'DELETE' })
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subscriptions'] }),
  })

  const currentEvent = EVENT_TYPES.find(e => e.value === eventType)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHero
        icon="🔔"
        title={<>通知<span className="text-gradient-banana">订阅</span></>}
        subtitle="当平台发生重要事件时,通过 Discord 或 Telegram 推送给你"
        badge={<StatBadge color="#fcd34d">NOTIFICATIONS</StatBadge>}
      />

      {/* 添加订阅 */}
      <Section icon="➕" title="添加订阅" subtitle="选择你关心的事件 + 推送平台" index={0}>
        <Field label="事件类型">
          <OptionGrid
            options={EVENT_TYPES.map(et => ({
              value: et.value,
              label: et.label,
              color: et.color,
            }))}
            value={eventType}
            onChange={(v: string) => setEventType(v)}
            cols={2}
            size="md"
          />
        </Field>

        <Field label="推送平台">
          <div className="grid grid-cols-2 gap-3">
            {PLATFORMS.map(p => {
              const active = targetType === p.value
              return (
                <button
                  key={p.value}
                  onClick={() => setTargetType(p.value)}
                  className={`p-4 rounded-2xl border-2 transition-all duration-300 ease-out-expo ${
                    active ? 'scale-[1.02]' : 'hover:scale-[1.01]'
                  }`}
                  style={
                    active
                      ? {
                          background: `${p.color}15`,
                          borderColor: `${p.color}80`,
                          boxShadow: `0 0 24px ${p.color}40`,
                        }
                      : { background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.08)' }
                  }
                >
                  <div className="text-2xl mb-2">{p.label.split(' ')[0]}</div>
                  <div className={`font-bold ${active ? '' : 'text-secondary'}`} style={active ? { color: p.color } : {}}>
                    {p.label.split(' ')[1]}
                  </div>
                  <div className="text-xs text-muted mt-1">{p.desc}</div>
                </button>
              )
            })}
          </div>
        </Field>

        <Field label={targetType === 'discord' ? 'Webhook URL' : 'Bot 配置'}>
          <input
            type="text"
            value={targetUrl}
            onChange={e => setTargetUrl(e.target.value)}
            placeholder={
              targetType === 'discord'
                ? 'https://discord.com/api/webhooks/...'
                : 'BOT_TOKEN|CHAT_ID (例如:1234567890:ABC|123456789)'
            }
            className="banana-input font-mono text-sm"
          />
          <InfoBadge type="info">
            {targetType === 'discord' ? 'Discord 服务器 → 频道设置 → Integrations → Webhooks' : '创建 Bot: @BotFather,然后把 Bot 加到群组'}
          </InfoBadge>
        </Field>

        <Field label="链(可选)">
          <select value={chainId} onChange={e => setChainId(e.target.value)} className="banana-input">
            <option value="">🌐 所有链</option>
            <option value="97">🔶 BNB Chain (Testnet)</option>
            <option value="11155111">🔷 Ethereum Sepolia</option>
            <option value="46630">🟢 Robinhood Chain</option>
            <option value="5042002">🌊 Circle Arc</option>
          </select>
        </Field>

        <button
          onClick={() => subscribe.mutate()}
          disabled={!targetUrl || subscribe.isPending}
          className="w-full btn-banana py-4 text-base disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {subscribe.isPending ? '订阅中...' : <>✨ 添加订阅</>}
        </button>
      </Section>

      {/* 当前订阅 */}
      <Section
        icon="📋"
        title="当前订阅"
        subtitle={`已配置 ${subs.length} 个订阅`}
        index={1}
        badge={<StatusPill variant="info">{subs.length}</StatusPill>}
      >
        {subs.length === 0 ? (
          <EmptyState
            emoji="🔕"
            title="还没有订阅"
            desc="添加第一个订阅,不错过任何重要事件"
          />
        ) : (
          <div className="space-y-2.5">
            {subs.map(sub => {
              const evt = EVENT_TYPES.find(e => e.value === sub.event_type)
              return (
                <div
                  key={sub.id}
                  className={`glass-premium rounded-2xl p-4 flex items-center gap-3 transition-all hover:scale-[1.01] ${
                    !sub.enabled && 'opacity-50'
                  }`}
                >
                  <div
                    className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                    style={{
                      background: `${evt?.color || '#fcd34d'}15`,
                      border: `1px solid ${evt?.color || '#fcd34d'}40`,
                    }}
                  >
                    {sub.target_type === 'discord' ? '🟣' : '✈️'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold">{EVENT_LABELS[sub.event_type] || sub.event_type}</div>
                    <div className="text-xs text-muted truncate font-mono">{sub.target_url}</div>
                    <div className="text-xs text-muted/70 mt-1 font-mono">
                      链: {sub.chain_id ? `Chain ID ${sub.chain_id}` : '全部'} ·
                      状态: {sub.enabled ? '✅ 启用' : '⏸️ 已停用'}
                    </div>
                  </div>
                  {sub.enabled && (
                    <button
                      onClick={() => unsubscribe.mutate(sub.id)}
                      className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20 transition-all border border-red-500/30"
                    >
                      停用
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Section>

      {/* 历史 */}
      {history.length > 0 && (
        <Section icon="📜" title="推送历史" subtitle="最近 20 条推送记录" index={2}>
          <div className="space-y-2">
            {history.map(h => (
              <div key={h.id} className="glass rounded-xl p-3 flex items-center gap-3 text-sm hover:scale-[1.005] transition-transform">
                <span className={h.status === 'success' ? 'text-green-400 text-lg' : 'text-red-400 text-lg'}>
                  {h.status === 'success' ? '✅' : '❌'}
                </span>
                <span className="text-xl">{h.target_type === 'discord' ? '🟣' : '✈️'}</span>
                <span className="font-medium">{EVENT_LABELS[h.event_type] || h.event_type}</span>
                <span className="text-muted ml-auto text-xs font-mono">
                  {new Date(h.sent_at).toLocaleString('zh-CN')}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}
