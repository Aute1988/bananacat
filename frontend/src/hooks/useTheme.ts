/**
 * useTheme - 主题管理 Hook
 * @returns {
 *   theme: 'dark' | 'light'
 *   toggle: 切换主题
 *   setTheme: 设为指定主题
 * }
 */
import { useState, useCallback, useEffect } from 'react'

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'banana-theme'

function getInitialTheme(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'dark' || saved === 'light') return saved
  // 🆕 系统偏好 fallback
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches) {
    return 'light'
  }
  return 'dark'
}

function applyThemeToDOM(t: Theme) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', t)
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme)

  // 🆕 只在 mount + theme 改变时应用(原来在 render 中执行,会触发不必要的重渲染)
  useEffect(() => {
    applyThemeToDOM(theme)
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
  }, [])

  const toggle = useCallback(() => {
    setThemeState(prev => (prev === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, toggle, setTheme }
}
