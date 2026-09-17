/**
 * 🎨 通用 UI 组件库 v3 - 高大上 · 科技感 · 颗粒感
 * - Section: 分组容器(渐变边框 + 顶部高光线)
 * - Field: 表单项
 * - Stepper: 数字徽章
 * - Panel: 浮动玻璃面板
 * - EmptyState: 空状态
 * - SkeletonCard: 骨架屏
 * - StatBadge: 数字徽章
 * - KeyValue: 键值对行
 * - StatusPill: 状态药丸
 * - Toast: 通知(保留兼容)
 */
import { useEffect, useState, type ReactNode, type CSSProperties } from 'react'

// ============================================================
// 1. Section - 顶级分组容器(带渐变边框 + 顶部高光线 + 网格底纹)
// ============================================================
interface SectionProps {
  title?: string
  subtitle?: string
  icon?: string
  badge?: ReactNode
  children: ReactNode
  className?: string
  variant?: 'default' | 'compact' | 'highlight'
  index?: number // 触发不同的流光
}

export function Section({ title, subtitle, icon, badge, children, className = '', variant = 'default', index = 0 }: SectionProps) {
  const variantClass = {
    default: 'glass-premium',
    compact: 'glass',
    highlight: 'glass-premium',
  }[variant]

  const highlightStyle = variant === 'highlight' ? {
    background: 'linear-gradient(135deg, rgba(252, 211, 77, 0.05), rgba(244, 114, 182, 0.03))',
  } : {}

  return (
    <section
      className={`${variantClass} rounded-2xl sm:rounded-3xl ${variant === 'default' ? 'p-6 sm:p-8' : 'p-5 sm:p-6'} ${className} animate-slide-up relative overflow-hidden`}
      style={{
        ...highlightStyle,
        animationDelay: `${index * 60}ms`,
      }}
    >
      {/* 网格底纹 */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(252, 211, 77, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(252, 211, 77, 0.5) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          maskImage: 'radial-gradient(ellipse 100% 100% at 50% 0%, #000 30%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse 100% 100% at 50% 0%, #000 30%, transparent 80%)',
        }}></div>

      {(title || badge) && (
        <div className="relative flex items-start gap-3 mb-5">
          {icon && (
            <div className="shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center text-2xl relative group-hover:scale-110 transition-transform"
              style={{
                background: 'linear-gradient(135deg, rgba(252, 211, 77, 0.18), rgba(244, 114, 182, 0.10))',
                border: '1px solid rgba(252, 211, 77, 0.35)',
                boxShadow: '0 8px 24px rgba(252, 211, 77, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
              }}>
              {icon}
            </div>
          )}
          <div className="flex-1 min-w-0">
            {title && (
              <h2 className="font-display text-xl sm:text-2xl font-black tracking-tight">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-xs text-muted mt-1 font-mono tracking-wide">{subtitle}</p>
            )}
          </div>
          {badge && <div className="shrink-0">{badge}</div>}
        </div>
      )}

      <div className="relative space-y-5">{children}</div>
    </section>
  )
}

// ============================================================
// 2. Field - 表单项(标签 + 提示 + 内容)
// ============================================================
interface FieldProps {
  label: string
  hint?: string
  required?: boolean
  optional?: boolean
  error?: string
  children: ReactNode
  className?: string
  mono?: boolean
}

export function Field({ label, hint, required, optional, error, children, className = '', mono }: FieldProps) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <label className={`block text-sm font-medium ${mono ? 'font-mono tracking-wide' : ''} ${error ? 'text-red-400' : 'text-secondary'}`}>
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
          {optional && <span className="text-muted ml-1.5 text-xs">(可选)</span>}
        </label>
        {hint && <span className="text-[0.65rem] font-mono text-muted">{hint}</span>}
      </div>
      {children}
      {error && (
        <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
          <span>⚠️</span> {error}
        </p>
      )}
    </div>
  )
}

// ============================================================
// 3. OptionGrid - 选项网格(用于分类/税率/锁仓等选择)
// ============================================================
interface OptionGridItem<T = any> {
  value: T
  emoji?: string
  label: string
  desc?: string
  color?: string
  highlight?: boolean
  badge?: string
}
interface OptionGridProps<T> {
  options: OptionGridItem<T>[]
  value: T
  onChange: (v: T) => void
  cols?: 2 | 3 | 4 | 5 | 6
  size?: 'sm' | 'md' | 'lg'
}
export function OptionGrid<T>({ options, value, onChange, cols = 3, size = 'md' }: OptionGridProps<T>) {
  const colsClass: Record<number, string> = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-2 sm:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-4',
    5: 'grid-cols-3 sm:grid-cols-5',
    6: 'grid-cols-3 sm:grid-cols-6',
  }
  const sizeClass = {
    sm: 'p-2.5 text-xs',
    md: 'p-3 sm:p-4 text-sm',
    lg: 'p-4 sm:p-5 text-base',
  }[size]

  return (
    <div className={`grid ${colsClass[cols]} gap-2.5`}>
      {options.map((opt) => {
        const active = value === opt.value
        const color = opt.color || '#fcd34d'
        return (
          <button
            key={String(opt.value)}
            onClick={() => onChange(opt.value)}
            className={`${sizeClass} rounded-xl border text-center transition-all duration-300 ease-out-expo relative overflow-hidden group ${
              active ? 'scale-[1.03]' : 'scale-100 hover:scale-[1.02]'
            }`}
            style={
              active
                ? {
                    background: `linear-gradient(135deg, ${color}25, ${color}10)`,
                    borderColor: `${color}80`,
                    boxShadow: `0 0 24px ${color}30, inset 0 1px 0 rgba(255,255,255,0.08)`,
                  }
                : {
                    background: 'rgba(255,255,255,0.02)',
                    borderColor: 'rgba(255,255,255,0.08)',
                  }
            }
          >
            {/* Active 顶部高光线 */}
            {active && (
              <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent"></div>
            )}
            {opt.emoji && <div className={`${size === 'sm' ? 'text-lg' : size === 'md' ? 'text-2xl' : 'text-3xl'} mb-1.5 transition-transform group-hover:scale-110`}>{opt.emoji}</div>}
            <div className={`font-bold ${active ? '' : 'text-secondary'}`} style={active ? { color } : {}}>
              {opt.label}
            </div>
            {opt.desc && (
              <div className="text-[0.65rem] text-muted mt-1 leading-snug line-clamp-2">{opt.desc}</div>
            )}
            {opt.badge && active && (
              <div className="absolute top-1.5 right-1.5 tag-warning text-[0.55rem]">{opt.badge}</div>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ============================================================
// 4. Toggle - 高级开关
// ============================================================
interface ToggleProps {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
  desc?: string
}
export function Toggle({ checked, onChange, label, desc }: ToggleProps) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 w-11 h-6 rounded-full transition-all duration-300 ease-out-expo mt-0.5`}
        style={{
          background: checked
            ? 'linear-gradient(135deg, #fcd34d, #f59e0b)'
            : 'rgba(255,255,255,0.08)',
          boxShadow: checked ? '0 0 16px rgba(252, 211, 77, 0.4)' : 'none',
        }}
      >
        <div
          className="absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all duration-300 ease-out-expo shadow-md"
          style={{ left: checked ? '22px' : '2px' }}
        ></div>
      </button>
      {(label || desc) && (
        <div className="flex-1 min-w-0">
          {label && <div className="text-sm font-medium text-secondary group-hover:text-primary transition-colors">{label}</div>}
          {desc && <div className="text-xs text-muted mt-0.5">{desc}</div>}
        </div>
      )}
    </label>
  )
}

// ============================================================
// 5. Panel - 浮动玻璃面板(高度概括)
// ============================================================
export function Panel({ children, className = '', glow = false }: { children: ReactNode; className?: string; glow?: boolean }) {
  return (
    <div className={`glass-premium rounded-2xl p-5 relative overflow-hidden ${className}`}>
      {glow && (
        <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-30 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(252, 211, 77, 0.6), transparent 70%)' }}></div>
      )}
      <div className="relative">{children}</div>
    </div>
  )
}

// ============================================================
// 6. EmptyState - 空状态(高级版)
// ============================================================
interface EmptyStateProps {
  emoji?: string
  title: string
  desc?: string
  action?: { label: string; onClick: () => void; variant?: 'primary' | 'secondary' }
}
export function EmptyState({ emoji = '🍌', title, desc, action }: EmptyStateProps) {
  return (
    <div className="glass-premium rounded-3xl p-12 text-center animate-fade-in relative overflow-hidden">
      <div className="absolute -top-32 -left-32 w-64 h-64 rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(252, 211, 77, 0.6), transparent 70%)' }}></div>
      <div className="relative space-y-4">
        <div className="text-7xl animate-float inline-block">{emoji}</div>
        <h3 className="font-display text-xl font-bold tracking-tight">{title}</h3>
        {desc && <p className="text-sm text-muted max-w-md mx-auto leading-relaxed">{desc}</p>}
        {action && (
          <button onClick={action.onClick} className={action.variant === 'secondary' ? 'btn-glass mt-4' : 'btn-banana mt-4'}>
            {action.label}
          </button>
        )}
      </div>
    </div>
  )
}

// ============================================================
// 7. SkeletonCard - 骨架屏
// ============================================================
export function SkeletonCard({ rows = 3, variant = 'row' }: { rows?: number; variant?: 'row' | 'card' | 'stat' }) {
  if (variant === 'stat') {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-premium rounded-2xl p-5 space-y-3">
            <div className="skeleton h-8 w-8 rounded-lg"></div>
            <div className="skeleton h-7 w-3/4"></div>
            <div className="skeleton h-3 w-1/2"></div>
          </div>
        ))}
      </div>
    )
  }

  if (variant === 'card') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="glass-premium rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="skeleton w-12 h-12 rounded-xl"></div>
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-1/2"></div>
                <div className="skeleton h-3 w-1/3"></div>
              </div>
            </div>
            <div className="skeleton h-12 w-full rounded-lg"></div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="glass-premium rounded-2xl p-4 flex items-center gap-3">
          <div className="skeleton w-10 h-10 rounded-xl shrink-0"></div>
          <div className="skeleton w-12 h-6 rounded-full shrink-0"></div>
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3 w-1/3"></div>
            <div className="skeleton h-2.5 w-1/4"></div>
          </div>
          <div className="skeleton h-8 w-20 rounded-lg shrink-0"></div>
        </div>
      ))}
    </div>
  )
}

// ============================================================
// 8. StatBadge - 数字徽章(Orbitron 字体)
// ============================================================
export function StatBadge({ children, color = '#fcd34d' }: { children: ReactNode; color?: string }) {
  return (
    <span
      className="inline-flex items-center justify-center font-orbitron font-bold text-[0.7rem] tracking-wider px-2 py-0.5 rounded-md"
      style={{
        background: `${color}15`,
        color,
        border: `1px solid ${color}40`,
      }}
    >
      {children}
    </span>
  )
}

// ============================================================
// 9. KeyValue - 键值对行(用于详情列表)
// ============================================================
export function KeyValue({ label, value, mono = false, copyable = false }: { label: string; value: ReactNode; mono?: boolean; copyable?: boolean }) {
  const handleCopy = () => {
    if (typeof value === 'string') navigator.clipboard.writeText(value)
  }
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
      <span className="text-xs text-muted font-medium uppercase tracking-wider">{label}</span>
      <span
        onClick={copyable ? handleCopy : undefined}
        className={`text-sm ${mono ? 'font-mono' : ''} ${copyable ? 'cursor-pointer hover:text-banana' : ''} transition-colors flex items-center gap-1.5`}
      >
        {value}
        {copyable && <span className="text-[0.6rem] opacity-40">📋</span>}
      </span>
    </div>
  )
}

// ============================================================
// 10. StatusPill - 状态药丸(高级版 tag)
// ============================================================
type StatusVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'glow'
export function StatusPill({ children, variant = 'neutral', icon, pulse = false, className = '' }: { children: ReactNode; variant?: StatusVariant; icon?: string; pulse?: boolean; className?: string }) {
  const variantClass = {
    success: 'tag-success',
    warning: 'tag-warning',
    danger: 'tag-danger',
    info: 'tag-purple',
    neutral: 'tag',
    glow: 'tag-glow',
  }[variant]
  return (
    <span className={`${variantClass} ${pulse ? 'animate-pulse' : ''} ${className}`}>
      {icon && <span>{icon}</span>}
      {children}
    </span>
  )
}

// ============================================================
// 11. ConnectingState - 未连接钱包状态
// ============================================================
interface ConnectingStateProps {
  emoji?: string
  title: string
  desc?: string
  onConnect: () => void
  fee?: string
  symbol?: string
}
export function ConnectingState({ emoji = '🔐', title, desc, onConnect, fee, symbol }: ConnectingStateProps) {
  return (
    <div className="max-w-lg mx-auto text-center py-20 space-y-6 animate-fade-in">
      <div className="relative inline-block">
        <div className="absolute inset-0 rounded-full blur-3xl opacity-50 animate-pulse"
          style={{ background: 'radial-gradient(circle, rgba(252, 211, 77, 0.6), transparent 70%)' }}></div>
        <div className="relative text-7xl animate-float">{emoji}</div>
      </div>
      <h1 className="font-display text-2xl sm:text-3xl font-black tracking-tight">{title}</h1>
      {desc && <p className="text-muted text-sm max-w-md mx-auto">{desc}</p>}
      {fee && (
        <div className="inline-flex items-center gap-2 glass px-4 py-2 rounded-full">
          <span className="text-xs text-muted">费用</span>
          <span className="font-bold text-banana">{fee} {symbol}</span>
        </div>
      )}
      <div>
        <button onClick={onConnect} className="btn-banana px-8 py-4 text-base">连接钱包</button>
      </div>
    </div>
  )
}

// ============================================================
// 12. NumberStepper - 数字输入 + - 按钮
// ============================================================
interface NumberStepperProps {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
}
export function NumberStepper({ value, onChange, min = 0, max = 100, step = 1, suffix }: NumberStepperProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - step))}
        className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 hover:border-banana/40 hover:bg-banana/10 transition-all text-banana font-bold"
      >−</button>
      <div className="flex-1 relative">
        <input
          type="number"
          value={value}
          onChange={(e) => {
            const v = Number(e.target.value)
            if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)))
          }}
          className="banana-input text-center font-mono"
          style={{ paddingRight: suffix ? '2rem' : '1rem' }}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted pointer-events-none">{suffix}</span>}
      </div>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + step))}
        className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 hover:border-banana/40 hover:bg-banana/10 transition-all text-banana font-bold"
      >+</button>
    </div>
  )
}

// ============================================================
// 13. AnimatedNumber - 数字动画
// ============================================================
export function AnimatedNumber({ value, suffix = '', className = '' }: { value: string | number; suffix?: string; className?: string }) {
  return (
    <span className={`font-orbitron tabular-nums ${className}`}>{value}{suffix}</span>
  )
}

// ============================================================
// 14. PageHero - 页面顶部 banner(统一风格)
// ============================================================
interface PageHeroProps {
  icon?: string
  title: ReactNode
  subtitle?: ReactNode
  badge?: ReactNode
  backLink?: { label: string; to: string }
  actions?: ReactNode
  variant?: 'gold' | 'aurora' | 'cosmic'
}
export function PageHero({ icon, title, subtitle, badge, backLink, actions, variant = 'gold' }: PageHeroProps) {
  const gradientClass = {
    gold: 'text-gradient-banana',
    aurora: 'text-gradient-aurora',
    cosmic: 'text-gradient-cosmic',
  }[variant]
  return (
    <div className="relative overflow-hidden rounded-3xl p-6 sm:p-10 mb-8 animate-fade-in">
      {/* 背景 */}
      <div className="absolute inset-0 glass-premium"></div>
      <div className="absolute -top-32 -right-32 w-72 h-72 rounded-full opacity-30 blur-3xl pointer-events-none animate-float-slow"
        style={{ background: 'radial-gradient(circle, rgba(252, 211, 77, 0.6), transparent 70%)' }}></div>
      <div className="absolute -bottom-32 -left-32 w-72 h-72 rounded-full opacity-25 blur-3xl pointer-events-none animate-float-reverse"
        style={{ background: 'radial-gradient(circle, rgba(183, 148, 246, 0.6), transparent 70%)' }}></div>

      <div className="relative space-y-3">
        {backLink && (
          <a href={backLink.to} className="text-xs text-muted hover:text-banana inline-flex items-center gap-1 transition-colors">
            ← {backLink.label}
          </a>
        )}
        {badge && <div className="mb-2">{badge}</div>}
        <div className="flex items-start gap-4 flex-wrap">
          {icon && (
            <div className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
              style={{
                background: 'linear-gradient(135deg, rgba(252, 211, 77, 0.2), rgba(244, 114, 182, 0.1))',
                border: '1px solid rgba(252, 211, 77, 0.4)',
                boxShadow: '0 0 32px rgba(252, 211, 77, 0.25)',
              }}>
              {icon}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className={`font-display text-3xl sm:text-4xl font-black tracking-tighter ${gradientClass}`}>
              {title}
            </h1>
            {subtitle && <p className="text-sm text-secondary mt-2 leading-relaxed">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      </div>
    </div>
  )
}

// 香蕉动画加载器(保留)
export function BananaLoader({ size = 64, text }: { size?: number; text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8">
      <div className="animate-spin-slow" style={{ fontSize: size, lineHeight: 1 }}>🍌</div>
      {text && <p className="text-sm text-muted animate-pulse">{text}</p>}
    </div>
  )
}

// 骨架屏行(本地实现,避免循环依赖)
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

// ============================================================
// 15. InfoBadge - 信息提示
// ============================================================
interface InfoBadgeProps {
  type?: 'info' | 'warning' | 'success' | 'danger'
  icon?: string
  children: ReactNode
}
export function InfoBadge({ type = 'info', icon, children }: InfoBadgeProps) {
  const colors: Record<string, { bg: string; border: string; text: string; icon: string }> = {
    info:    { bg: 'rgba(125, 211, 252, 0.05)',  border: 'rgba(125, 211, 252, 0.25)', text: '#7dd3fc', icon: '💡' },
    warning: { bg: 'rgba(252, 211, 77, 0.05)',   border: 'rgba(252, 211, 77, 0.3)',   text: '#fcd34d', icon: '⚠️' },
    success: { bg: 'rgba(52, 211, 153, 0.05)',   border: 'rgba(52, 211, 153, 0.25)',  text: '#34d399', icon: '✅' },
    danger:  { bg: 'rgba(251, 113, 133, 0.05)',  border: 'rgba(251, 113, 133, 0.25)', text: '#fb7185', icon: '❌' },
  }
  const c = colors[type]
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl backdrop-blur-xl" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
      <span className="text-lg shrink-0">{icon || c.icon}</span>
      <div className="flex-1 text-sm leading-relaxed" style={{ color: c.text }}>{children}</div>
    </div>
  )
}

// ============================================================
// 16. Progress - 进度条(高级版)
// ============================================================
export function Progress({ value, color = '#fcd34d', height = 8, showLabel = false }: { value: number; color?: string; height?: number; showLabel?: boolean }) {
  return (
    <div className="relative">
      <div
        className="rounded-full overflow-hidden"
        style={{
          height,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div
          className="h-full rounded-full relative overflow-hidden transition-all duration-700 ease-out-expo"
          style={{
            width: `${Math.min(value, 100)}%`,
            background: `linear-gradient(90deg, ${color}, ${color}cc)`,
            boxShadow: `0 0 16px ${color}50`,
          }}
        >
          <div className="absolute inset-0 opacity-50"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 2.5s linear infinite',
            }}></div>
        </div>
      </div>
      {showLabel && (
        <div className="absolute inset-0 flex items-center justify-center text-[0.65rem] font-bold" style={{ color, textShadow: '0 0 8px rgba(0,0,0,0.6)' }}>
          {value.toFixed(1)}%
        </div>
      )}
    </div>
  )
}

// ============================================================
// 17. CompactCard - 紧凑卡片
// ============================================================
interface CompactCardProps {
  children: ReactNode
  onClick?: () => void
  className?: string
  glow?: boolean
}
export function CompactCard({ children, onClick, className = '', glow = false }: CompactCardProps) {
  return (
    <div
      onClick={onClick}
      className={`glass-premium rounded-2xl p-4 sm:p-5 transition-all duration-300 ease-out-expo ${className} ${onClick ? 'cursor-pointer hover:scale-[1.02]' : ''} ${glow ? 'hover:shadow-glow-banana' : ''}`}
    >
      {children}
    </div>
  )
}

// ============================================================
// Toast(从 CommonUI 移过来,统一管理)
// ============================================================
type ToastType = 'success' | 'error' | 'info' | 'warn'

interface ToastItem {
  id: number
  type: ToastType
  message: string
}

let _externalPush: ((t: Omit<ToastItem, 'id'>) => void) | null = null

export function setToastHandler(fn: (t: Omit<ToastItem, 'id'>) => void) {
  _externalPush = fn
}

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
          <div
            key={item.id}
            className="px-4 py-2.5 rounded-xl shadow-2xl animate-slide-up pointer-events-auto max-w-sm backdrop-blur-xl flex items-center gap-2 text-sm font-medium"
            style={{
              background: s.bg,
              border: `1px solid ${s.border}`,
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            }}
          >
            <span className="text-base">{s.emoji}</span>
            <span>{item.message}</span>
          </div>
        )
      })}
    </div>
  )
}

// 香蕉动画加载器(已定义在文件前面,这里不再重复)

