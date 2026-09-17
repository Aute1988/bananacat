/**
 * LanguageSwitcher - 语言切换下拉组件
 * 放在 Layout Header 的右上角
 */
import { useState, useRef, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { LANGUAGES, setLanguage } from '../i18n'

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  // 🆕 用 useMemo 保证一致性,且当 i18n.language 变化时重新计算
  const current = useMemo(
    () => LANGUAGES.find(l => l.code === i18n.language) || LANGUAGES[0],
    [i18n.language]
  )

  // 点击外部关闭
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium
                   bg-dark-200 border border-white/10 hover:border-yellow-500/30 transition-all"
      >
        <span>{current.flag}</span>
        <span className="hidden sm:inline">{current.native}</span>
        <span className="text-xs text-gray-400">▾</span>
      </button>

      {open && (
        <div
          className="absolute right-0 sm:right-0 mt-2 z-50 w-48 max-h-80 overflow-y-auto
                     bg-dark-100 border border-white/10 rounded-2xl shadow-2xl animate-slide-down"
        >
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => {
                setLanguage(lang.code)
                setOpen(false)
              }}
              className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-white/5 transition-colors first:rounded-t-2xl last:rounded-b-2xl ${
                lang.code === i18n.language
                  ? 'bg-yellow-500/10 text-yellow-400'
                  : 'text-white'
              }`}
            >
              <span>{lang.flag}</span>
              <span className="flex-1 text-left">{lang.native}</span>
              {lang.code === i18n.language && <span className="text-yellow-400">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
