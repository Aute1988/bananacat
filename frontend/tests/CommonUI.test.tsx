/**
 * CommonUI 组件测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { BananaLoader, EmptyState, SkeletonRow, ToastContainer, toast } from '../src/components/CommonUI'

describe('BananaLoader', () => {
  it('渲染香蕉 emoji', () => {
    render(<BananaLoader />)
    expect(screen.getByText('🍌')).toBeInTheDocument()
  })

  it('显示 text', () => {
    render(<BananaLoader text="Loading..." />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })
})

describe('EmptyState', () => {
  it('渲染标题和描述', () => {
    render(<EmptyState title="No data" desc="Nothing here" />)
    expect(screen.getByText('No data')).toBeInTheDocument()
    expect(screen.getByText('Nothing here')).toBeInTheDocument()
  })

  it('action 按钮点击触发回调', () => {
    const onClick = vi.fn()
    render(<EmptyState title="Empty" action={{ label: 'Reload', onClick }} />)
    fireEvent.click(screen.getByText('Reload'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe('SkeletonRow', () => {
  it('渲染默认 3 行', () => {
    const { container } = render(<SkeletonRow />)
    // 3 个 skeleton 行
    const cards = container.querySelectorAll('.banana-card')
    expect(cards.length).toBe(3)
  })

  it('支持自定义行数', () => {
    const { container } = render(<SkeletonRow rows={5} />)
    const cards = container.querySelectorAll('.banana-card')
    expect(cards.length).toBe(5)
  })
})

describe('ToastContainer + toast()', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('toast() 推送一条消息', () => {
    render(<ToastContainer />)
    act(() => toast('Hello', 'success'))
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('4 秒后自动消失', () => {
    render(<ToastContainer />)
    act(() => toast('Bye', 'info'))
    expect(screen.getByText('Bye')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(4001)
    })
    expect(screen.queryByText('Bye')).not.toBeInTheDocument()
  })

  it('不同类型显示不同 emoji', () => {
    render(<ToastContainer />)
    act(() => {
      toast('Success', 'success')
      toast('Error', 'error')
      toast('Warning', 'warn')
      toast('Info', 'info')
    })
    expect(screen.getByText('✅')).toBeInTheDocument()
    expect(screen.getByText('❌')).toBeInTheDocument()
    expect(screen.getByText('⚠️')).toBeInTheDocument()
    expect(screen.getByText('ℹ️')).toBeInTheDocument()
  })

  it('卸载时清理所有 timer(内存泄漏保护)', () => {
    const { unmount } = render(<ToastContainer />)
    act(() => toast('Test', 'info'))
    expect(screen.getByText('Test')).toBeInTheDocument()

    unmount()

    act(() => {
      vi.advanceTimersByTime(5000)
    })
    // 不应抛错(timer 被清理)
  })
})
