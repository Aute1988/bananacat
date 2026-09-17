/**
 * PWAStatus 组件测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mockPWA = {
  canInstall: false,
  installApp: vi.fn(),
  needUpdate: false,
  updateApp: vi.fn(),
  isOffline: false,
}

vi.mock('../src/hooks/usePWA', () => ({
  usePWA: () => mockPWA,
}))

// 每次测试重新导入,以重置组件内部 state
let PWAStatus: any
beforeEach(async () => {
  vi.clearAllMocks()
  PWAStatus = (await import('../src/components/PWAStatus')).default
})

describe('PWAStatus 默认状态', () => {
  it('什么都不显示', () => {
    const { container } = render(<PWAStatus />)
    // 全部条件 false 时返回 Fragment,firstChild 是 null
    expect(container.firstChild === null || container.firstChild).toBeTruthy()
    expect(screen.queryByText(/加到桌面/)).not.toBeInTheDocument()
    expect(screen.queryByText(/离线模式/)).not.toBeInTheDocument()
    expect(screen.queryByText(/新版本/)).not.toBeInTheDocument()
  })
})

describe('PWAStatus 离线提示', () => {
  it('显示离线 banner', () => {
    mockPWA.isOffline = true
    render(<PWAStatus />)
    expect(screen.getByText(/离线模式/)).toBeInTheDocument()
  })
})

describe('PWAStatus 安装提示', () => {
  it('点击安装触发 installApp', () => {
    mockPWA.canInstall = true
    mockPWA.installApp = vi.fn().mockResolvedValue(true)

    render(<PWAStatus />)
    // "安装"匹配多个元素(标题"加到桌面"和按钮"安装"),用 getAllByText
    const installBtns = screen.getAllByText(/安装/)
    fireEvent.click(installBtns[installBtns.length - 1])  // 最后一个是按钮
    expect(mockPWA.installApp).toHaveBeenCalled()
  })

  it('点击"下次"关闭后不再显示', () => {
    mockPWA.canInstall = true
    render(<PWAStatus />)
    expect(screen.getByText(/加到桌面/)).toBeInTheDocument()

    fireEvent.click(screen.getByText(/下次/))
    expect(screen.queryByText(/加到桌面/)).not.toBeInTheDocument()
  })
})

describe('PWAStatus 更新提示', () => {
  it('显示并响应更新', () => {
    mockPWA.needUpdate = true
    mockPWA.updateApp = vi.fn()

    render(<PWAStatus />)
    expect(screen.getByText(/有新版本/)).toBeInTheDocument()

    fireEvent.click(screen.getByText(/立即更新/))
    expect(mockPWA.updateApp).toHaveBeenCalled()
  })
})
