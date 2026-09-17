/**
 * useTheme hook 测试
 */
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTheme } from '../src/hooks/useTheme'

describe('useTheme', () => {
  it('默认 dark 主题', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('localStorage 优先', () => {
    localStorage.setItem('banana-theme', 'light')
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('light')
  })

  it('toggle 切换主题', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('dark')

    act(() => result.current.toggle())
    expect(result.current.theme).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(localStorage.getItem('banana-theme')).toBe('light')

    act(() => result.current.toggle())
    expect(result.current.theme).toBe('dark')
    expect(localStorage.getItem('banana-theme')).toBe('dark')
  })

  it('setTheme 直接设置', () => {
    const { result } = renderHook(() => useTheme())

    act(() => result.current.setTheme('light'))
    expect(result.current.theme).toBe('light')
    expect(localStorage.getItem('banana-theme')).toBe('light')

    act(() => result.current.setTheme('dark'))
    expect(result.current.theme).toBe('dark')
  })

  it('localStorage 保存的主题立即应用', () => {
    localStorage.setItem('banana-theme', 'light')
    const { result } = renderHook(() => useTheme())
    // useEffect 会触发 DOM 更新
    expect(result.current.theme).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })
})
