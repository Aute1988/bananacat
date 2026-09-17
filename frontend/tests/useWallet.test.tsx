/**
 * useWallet hook 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { WalletProvider, useWallet } from '../src/hooks/useWallet'

function wrapper({ children }: { children: React.ReactNode }) {
  return <WalletProvider>{children}</WalletProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useWallet 初始状态', () => {
  it('默认未连接,链 bsc', () => {
    const { result } = renderHook(() => useWallet(), { wrapper })
    expect(result.current.address).toBeNull()
    expect(result.current.chain).toBe('bsc')
    expect(result.current.isConnecting).toBe(false)
  })
})

describe('useWallet connect', () => {
  it('没有 ethereum 时返回(不抛错)', async () => {
    const original = (window as any).ethereum
    delete (window as any).ethereum

    const { result } = renderHook(() => useWallet(), { wrapper })
    await act(async () => {
      await result.current.connect()
    })

    expect(result.current.address).toBeNull()
    expect(result.current.isConnecting).toBe(false)

    ;(window as any).ethereum = original
  })

  it('成功连接后设置地址', async () => {
    const requestMock = vi.fn(async ({ method }: any) => {
      if (method === 'eth_requestAccounts') return ['0xabc']
      if (method === 'eth_chainId') return '0x61'
      return null
    })
    ;(window as any).ethereum.request = requestMock

    const { result } = renderHook(() => useWallet(), { wrapper })
    await act(async () => {
      await result.current.connect()
    })

    expect(result.current.address).toBe('0xabc')
    expect(requestMock).toHaveBeenCalledWith({ method: 'eth_requestAccounts' })
  })

  it('连接失败后 isConnecting 回到 false', async () => {
    ;(window as any).ethereum.request = vi.fn(async () => {
      throw new Error('User rejected')
    })

    const { result } = renderHook(() => useWallet(), { wrapper })
    await act(async () => {
      await result.current.connect()
    })

    expect(result.current.isConnecting).toBe(false)
    expect(result.current.address).toBeNull()
  })
})

describe('useWallet disconnect', () => {
  it('清空 address', async () => {
    const requestMock = vi.fn(async ({ method }: any) => {
      if (method === 'eth_requestAccounts') return ['0xabc']
      if (method === 'eth_chainId') return '0x61'
      return null
    })
    ;(window as any).ethereum.request = requestMock

    const { result } = renderHook(() => useWallet(), { wrapper })
    await act(async () => { await result.current.connect() })
    expect(result.current.address).toBe('0xabc')

    act(() => result.current.disconnect())
    expect(result.current.address).toBeNull()
  })
})

describe('useWallet switchChain', () => {
  it('调用 wallet_switchEthereumChain', async () => {
    const requestMock = vi.fn(async ({ method }: any) => {
      if (method === 'wallet_switchEthereumChain') return null
      return null
    })
    ;(window as any).ethereum.request = requestMock

    const { result } = renderHook(() => useWallet(), { wrapper })
    await act(async () => {
      await result.current.switchChain('ethereum')
    })

    expect(requestMock).toHaveBeenCalledWith({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0xaa36a7' }], // sepolia
    })
    expect(result.current.chain).toBe('ethereum')
  })

  it('用户拒绝时不切换', async () => {
    ;(window as any).ethereum.request = vi.fn(async () => {
      throw new Error('User rejected')
    })

    const { result } = renderHook(() => useWallet(), { wrapper })
    await act(async () => {
      await result.current.switchChain('ethereum')
    })

    expect(result.current.chain).toBe('bsc') // 没切换
  })
})
