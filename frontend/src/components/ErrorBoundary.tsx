import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * 全局错误边界 — 把组件树渲染期异常变成可见的红色 banner,
 * 而不是 React 18 默认的"静默白屏"。上线后用来快速诊断：
 *   - RainbowKit 初始化失败
 *   - wagmi connector chain 不匹配
 *   - 页面级 throw 都被这里兜住
 */
interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          style={{
            position: 'fixed',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            padding: 24,
            background: 'rgba(10,10,20,0.92)',
            color: '#fff',
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif',
            zIndex: 99999,
          }}
        >
          <div
            style={{
              maxWidth: 720,
              padding: 24,
              borderRadius: 12,
              border: '1px solid #f59e0b',
              background: 'rgba(245,158,11,0.08)',
            }}
          >
            <h1 style={{ margin: 0, fontSize: 20, color: '#fbbf24' }}>
              🐱 香蕉猫 Launchpad 渲染失败
            </h1>
            <p style={{ marginTop: 12, color: '#fcd34d' }}>
              {this.state.error.message}
            </p>
            <pre
              style={{
                marginTop: 12,
                padding: 12,
                background: 'rgba(0,0,0,0.4)',
                borderRadius: 8,
                fontSize: 12,
                overflow: 'auto',
                maxHeight: 240,
                color: '#fda4af',
              }}
            >
              {this.state.error.stack}
            </pre>
            <button
              onClick={() => location.reload()}
              style={{
                marginTop: 16,
                padding: '8px 16px',
                borderRadius: 8,
                background: '#f59e0b',
                color: '#1a1a1a',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              刷新页面
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
