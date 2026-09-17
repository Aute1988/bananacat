/**
 * 通用 UI 组件兼容层
 */
import { useEffect, useState } from 'react'

export function BananaLoader({ size = 64, text }: { size?: number; text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8">
      <div className="animate-spin-slow" style={{ fontSize: size, lineHeight: 1 }}>🍌</div>
      {text && <p className="text-sm text-muted animate-pulse">{text}</p>}
    </div>
  )
}

export function SkeletonRow({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="glass-premium rounded-2xl p-4 flex items-center gap-3">
          <div className="skeleton w-10 h-10 rounded-xl shrink-0" />
          <div className="skeleton w-12 h-6 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3 w-1/3" />
            <div className="skeleton h-2.5 w-1/4" />
          </div>
          <div className="skeleton h-8 w-20 rounded-lg shrink-0" />
        </div>
      ))}
    </div>
  )
}

export function EmptyState({ emoji = '🍌', title, desc, action }: { emoji?: string; title: string; desc?: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="glass-premium rounded-3xl p-12 text-center animate-fade-in relative overflow-hidden">
      <div className="text-7xl mb-4 animate-float inline-block">{emoji}</div>
      <h3 className="font-display text-xl font-bold tracking-tight">{title}</h3>
      {desc && <p className="text-sm text-muted max-w-md mx-auto mb-4">{desc}</p>}
      {action && <button onClick={action.onClick} className="btn-banana">{action.label}</button>}
    </div>
  )
}

// Toast
type ToastType = 'success' | 'error' | 'info' | 'warn'
interface ToastItem { id: number; type: ToastType; message: string }

let _externalPush: ((t: Omit<ToastItem, 'id'>) => void) | null = null
export function setToastHandler(fn: (t: Omit<ToastItem, 'id'>) => void) { _externalPush = fn }
export function toast(message: string, type: ToastType = 'info') {
  if (_externalPush) _externalPush({ message, type })
}

const TOAST_STYLES: Record<ToastType, { bg: string; emoji: string; border: string }> = {
  success: { bg: 'rgba(52, 211, 153, 0.15)',  emoji: '✅', border: 'rgba(52, 211, 153, 0.4)' },
  error:   { bg: 'rgba(251, 113, 133, 0.15)', emoji: '❌', border: 'rgba(251, 113, 133, 0.4)' },
  warn:    { bg: 'rgba(252, 211, 77, 0.15)',  emoji: '⚠️', border: 'rgba(252, 211, 77, 0.4)' },
  info:    { bg: 'rgba(125, 211, 252, 0.15)', emoji: 'ℹ️', border: 'rgba(125, 211, 252, 0.4)' },
}

export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([])
  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>()
    setToastHandler(({ message, type }) => {
      const id = Date.now() + Math.random()
      setItems(prev => [...prev, { id, message, type }])
      const t = setTimeout(() => {
        setItems(prev => prev.filter(i => i.id !== id))
        timers.delete(t)
      }, 4000)
      timers.add(t)
    })
    return () => {
      setToastHandler(() => {})
      timers.forEach(t => clearTimeout(t))
      timers.clear()
    }
  }, [])
  return (
    <div className="fixed bottom-4 right-4 z-[100] space-y-2 pointer-events-none">
      {items.map(item => {
        const s = TOAST_STYLES[item.type]
        return (
          <div key={item.id} className="px-4 py-2.5 rounded-xl shadow-2xl animate-slide-up pointer-events-auto max-w-sm backdrop-blur-xl flex items-center gap-2 text-sm font-medium"
            style={{ background: s.bg, border: `1px solid ${s.border}`, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
            <span className="text-base">{s.emoji}</span>
            <span>{item.message}</span>
          </div>
        )
      })}
    </div>
  )
}
