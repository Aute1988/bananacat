/**
 * LanguageSwitcher 组件测试
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LanguageSwitcher from '../src/components/LanguageSwitcher'

describe('LanguageSwitcher', () => {
  it('点击展开下拉', () => {
    render(<LanguageSwitcher />)
    const button = screen.getByRole('button')
    fireEvent.click(button)
    expect(screen.getByText('简体中文')).toBeInTheDocument()
    // 'English' 至少出现一次(下拉里有);按钮上的标签也是 English,但我们只要验证下拉展开了
    expect(screen.getAllByText('English').length).toBeGreaterThanOrEqual(1)
  })

  it('点击外部关闭', async () => {
    render(<div><LanguageSwitcher /><div data-testid="outside">outside</div></div>)
    const button = screen.getByRole('button')
    fireEvent.click(button)
    // 展开后应该有多个"English"(按钮 + 下拉项)
    expect(screen.getAllByText('English').length).toBeGreaterThanOrEqual(2)

    fireEvent.mouseDown(screen.getByTestId('outside'))

    await waitFor(() => {
      // 关闭后只剩按钮上的一个
      expect(screen.getAllByText('English').length).toBe(1)
    })
  })

  it('切换语言后更新 i18n + localStorage', () => {
    render(<LanguageSwitcher />)
    fireEvent.click(screen.getByRole('button'))

    const enButton = screen.getAllByText('English')[1]  // 下拉里的"English"
    fireEvent.click(enButton)

    expect(localStorage.getItem('banana-lang')).toBe('en')
    expect(document.documentElement.lang).toBe('en')
    expect(document.documentElement.dir).toBe('ltr')
  })

  it('切换到阿拉伯语应用 RTL', () => {
    render(<LanguageSwitcher />)
    fireEvent.click(screen.getByRole('button'))

    const arButton = screen.getAllByText('العربية')[0]
    fireEvent.click(arButton)

    expect(localStorage.getItem('banana-lang')).toBe('ar')
    expect(document.documentElement.lang).toBe('ar')
    expect(document.documentElement.dir).toBe('rtl')
  })
})
