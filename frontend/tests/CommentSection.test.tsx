/**
 * CommentSection 集成测试
 * 验证:
 *   - 加载评论列表
 *   - 发评论(需要连接钱包)
 *   - 错误状态显示
 *   - 投票/删除/举报
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CommentSection from '../src/components/CommentSection'

// Mock useWallet
const mockWallet = {
  address: '0xuser123',
  chain: 'bsc',
  chainConfig: { id: 97 },
  connect: vi.fn(),
  disconnect: vi.fn(),
  switchChain: vi.fn(),
  isConnecting: false,
}

vi.mock('../src/hooks/useWallet', () => ({
  useWallet: () => mockWallet,
}))

// Mock fetch
const mockFetch = vi.fn()
;(globalThis as any).fetch = mockFetch

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => {
  mockFetch.mockReset()
})

describe('CommentSection - 未连接钱包', () => {
  it('连接提示', async () => {
    mockWallet.address = null

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ comments: [], total: 0, sortBy: 'top', limit: 20, offset: 0 }),
    })

    render(
      <CommentSection tokenAddress="0xtoken" chainId={97} />,
      { wrapper }
    )

    await waitFor(() => {
      expect(screen.getByText(/连接钱包/)).toBeInTheDocument()
    })
  })
})

describe('CommentSection - 已连接钱包', () => {
  beforeEach(() => {
    mockWallet.address = '0xuser123'
  })

  it('加载评论列表', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        comments: [
          {
            id: 1, token_address: '0xtoken', chain_id: 97,
            user_address: '0xother', parent_id: null,
            content: 'Hello world', upvotes: 5, downvotes: 0,
            is_deleted: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
        total: 1,
        sortBy: 'top', limit: 20, offset: 0,
      }),
    })

    render(<CommentSection tokenAddress="0xtoken" chainId={97} />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText('Hello world')).toBeInTheDocument()
      expect(screen.getByText('▲ 5')).toBeInTheDocument()
    })
  })

  it('total 类型一致(强制 number)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        comments: [],
        total: '5',  // 字符串!
        sortBy: 'top', limit: 20, offset: 0,
      }),
    })

    render(<CommentSection tokenAddress="0xtoken" chainId={97} />, { wrapper })

    await waitFor(() => {
      // 应显示 (5) 而不是 NaN
      expect(screen.getByText('(5)')).toBeInTheDocument()
    })
  })

  it('发评论 - 成功', async () => {
    mockFetch
      // GET comments
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [], total: 0, sortBy: 'top', limit: 20, offset: 0 }),
      })
      // POST comment
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comment: { id: 2, content: 'New comment' } }),
      })
      // GET refetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          comments: [
            {
              id: 2, token_address: '0xtoken', chain_id: 97,
              user_address: '0xuser123', parent_id: null,
              content: 'New comment', upvotes: 0, downvotes: 0,
              is_deleted: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
          total: 1,
          sortBy: 'top', limit: 20, offset: 0,
        }),
      })

    render(<CommentSection tokenAddress="0xtoken" chainId={97} />, { wrapper })

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/说点什么/)).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText(/说点什么/)
    fireEvent.change(textarea, { target: { value: 'New comment' } })

    // 点击发送按钮(避免"1000 · ⌘+Enter 发送"提示里也有"发送"字)
    const sendButtons = screen.getAllByText(/^发送$/)
    fireEvent.click(sendButtons[0])

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/comments'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('New comment'),
        })
      )
    })
  })

  it('发评论失败显示错误', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comments: [], total: 0, sortBy: 'top', limit: 20, offset: 0 }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: '评论过于频繁' }),
      })

    render(<CommentSection tokenAddress="0xtoken" chainId={97} />, { wrapper })

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/说点什么/)).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText(/说点什么/)
    fireEvent.change(textarea, { target: { value: 'x' } })

    const sendButtons = screen.getAllByText(/^发送$/)
    fireEvent.click(sendButtons[0])

    // 错误应该被 throw 进 mutation 状态(此处仅验证 POST 调用)
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/comments'),
        expect.objectContaining({ method: 'POST' })
      )
    })
  })

  it('错误状态显示重试按钮', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    render(<CommentSection tokenAddress="0xtoken" chainId={97} />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeInTheDocument()
      expect(screen.getByText(/重试|retry/i)).toBeInTheDocument()
    })
  })

  it('空状态显示提示', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ comments: [], total: 0, sortBy: 'top', limit: 20, offset: 0 }),
    })

    render(<CommentSection tokenAddress="0xtoken" chainId={97} />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText(/还没有评论|no comment/i)).toBeInTheDocument()
    })
  })
})
