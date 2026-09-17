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
//
// 关键: 我们必须等到 React tree mount 完成才能给子元素设高度,所以
// 用 MutationObserver 监听 #root 的子节点变化,一旦子元素出现就
// 立刻把视口高度写到它和所有新出现的直接子元素上。
function applyRootHeightFallback() {
  const root = document.getElementById('root')
  if (!root) return
  const setH = (el: Element) => {
    const h = window.innerHeight
    ;(el as HTMLElement).style.minHeight = h + 'px'
  }
  const sync = () => {
    setH(root)
    for (const child of Array.from(root.children)) setH(child)
  }
  sync()
  window.addEventListener('resize', sync)

  // MutationObserver: 监听 #root 子节点变化,React 每次 mount 时
  // 会插入新的子元素,我们要立即给它们设 minHeight
  const mo = new MutationObserver(sync)
  mo.observe(root, { childList: true, subtree: false })

  // 兜底: 1s 后再 sync 一次,确保 React 异步 mount 的元素也能拿到
  setTimeout(sync, 100)
  setTimeout(sync, 500)
  setTimeout(sync, 1500)
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
