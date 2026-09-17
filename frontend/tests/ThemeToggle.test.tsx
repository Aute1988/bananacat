/**
 * ThemeToggle 组件测试
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ThemeToggle from '../src/components/ThemeToggle'

describe('ThemeToggle', () => {
  it('点击切换主题', () => {
    render(<ThemeToggle />)
    // 默认 dark,显示太阳图标(svg)
    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()

    fireEvent.click(button)
    // 切到 light 后应该显示月亮
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')

    fireEvent.click(button)
    // 再切回 dark
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })
})
