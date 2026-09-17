import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'  // RainbowKit 样式
import App from './App'
import { wagmiConfig } from './chains/wagmi'
import ErrorBoundary from './components/ErrorBoundary'
import './styles/globals.css'
import './i18n' // 🌍 i18n 多语言

// 🌓 应用初始主题(避免初次渲染时主题闪烁)
function getInitialTheme(): 'dark' | 'light' {
  const saved = localStorage.getItem('banana-theme')
  if (saved === 'dark' || saved === 'light') return saved
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches) {
    return 'light'
  }
  return 'dark'
}
document.documentElement.setAttribute('data-theme', getInitialTheme())

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 10_000,
      // 🆕 不要在窗口聚焦时一直 refetch,减少服务器压力
      refetchOnWindowFocus: false,
    },
  },
})

// 🩹 全局兜底: #root + 它的直接子元素都强制 min-height 到视口高度
// 这是为了绕过 chromium 在 #root { isolation:isolate } 上下文下
// min-height: 100vh 计算成 134px 这种 bug。inline style + px 单位
// 比 vh 永远稳定。
function applyRootHeightFallback() {
  const root = document.getElementById('root')
  if (!root) return
  const setH = () => {
    const h = window.innerHeight
    root.style.minHeight = h + 'px'
    // 直接子元素也要撑开
    for (const child of Array.from(root.children)) {
      ;(child as HTMLElement).style.minHeight = h + 'px'
    }
  }
  setH()
  window.addEventListener('resize', setH)
}
applyRootHeightFallback()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
