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
