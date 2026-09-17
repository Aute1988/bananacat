/**
 * 测试全局 setup
 */
import '@testing-library/jest-dom/vitest'
import { vi, beforeEach } from 'vitest'

// 🔑 Mock react-i18next(避免组件需要 i18n Provider)
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => {
      // 提供 fallback 默认值,让测试能看到有意义的文本
      const dict: Record<string, string> = {
        'comments.title': '评论',
        'comments.placeholder': '说点什么...',
        'comments.top': '最热',
        'comments.latest': '最新',
        'comments.send': '发送',
        'comments.cancel': '取消',
        'comments.reply': '回复',
        'comments.report': '举报',
        'comments.delete': '删除',
        'comments.loginRequired': '请连接钱包后参与评论',
        'comments.loadMore': '加载更多',
        'comments.replyTo': '回复',
        'comments.reportReason': '举报原因',
        'token.noComments': '还没有评论,快来抢沙发~',
        'common.cancel': '取消',
        'common.confirm': '确认',
        'wallet.connect': '连接钱包',
        'wallet.disconnect': '断开连接',
      }
      return dict[key] || fallback || key
    },
    i18n: { changeLanguage: vi.fn(), language: 'zh' },
    ready: true,
  }),
  Trans: ({ children }: any) => children,
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

// Mock window.ethereum
;(globalThis as any).window.ethereum = {
  request: vi.fn(async ({ method }: any) => {
    if (method === 'eth_accounts') return []
    if (method === 'eth_chainId') return '0x61' // BSC testnet
    return null
  }),
  on: vi.fn(),
  removeListener: vi.fn(),
}

// Mock matchMedia
;(globalThis as any).window.matchMedia = (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
})

// Mock ResizeObserver(Recharts 需要)
;(globalThis as any).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Mock IntersectionObserver(DocsPage)
;(globalThis as any).IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return [] }
  root = null
  rootMargin = ''
  thresholds = []
}

// 清空 localStorage between tests
beforeEach(() => {
  localStorage.clear()
})
