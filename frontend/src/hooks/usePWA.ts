/**
 * usePWA - PWA 安装 + 更新检测 Hook
 * @returns {
 *   canInstall: 浏览器是否触发「添加到主屏幕」事件
 *   installApp: 触发安装
 *   needUpdate: 有新版本可用
 *   updateApp: 通知用户刷新
 *   isOffline: 当前是否离线
 * }
 */
import { useEffect, useState, useCallback } from 'react'

export function usePWA() {
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [needUpdate, setNeedUpdate] = useState(false)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)

  // ===== 安装提示 =====
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // ===== 在线 / 离线 =====
  useEffect(() => {
    const online = () => {
      setIsOffline(false)
      // 重新请求后台同步
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        navigator.serviceWorker.ready.then((reg) => {
          (reg as any).sync?.register('sync-trades')
        }).catch(() => {})
      }
    }
    const offline = () => setIsOffline(true)
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    return () => {
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
    }
  }, [])

  // ===== SW 更新 =====
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const onUpdate = (reg: ServiceWorkerRegistration) => {
      const newWorker = reg.installing || reg.waiting
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setNeedUpdate(true)
            setWaitingWorker(newWorker)
          }
        })
      }
    }

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return
      if (reg.waiting && navigator.serviceWorker.controller) {
        setNeedUpdate(true)
        setWaitingWorker(reg.waiting)
      }
      reg.addEventListener('updatefound', () => onUpdate(reg))
    })

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // 新 SW 接管,自动刷新
      window.location.reload()
    })
  }, [])

  const installApp = useCallback(async () => {
    if (!installPrompt) return false
    installPrompt.prompt()
    const choice = await installPrompt.userChoice
    setInstallPrompt(null)
    return choice.outcome === 'accepted'
  }, [installPrompt])

  const updateApp = useCallback(() => {
    if (!waitingWorker) return
    waitingWorker.postMessage({ type: 'SKIP_WAITING' })
  }, [waitingWorker])

  return {
    canInstall: !!installPrompt,
    installApp,
    needUpdate,
    updateApp,
    isOffline,
  }
}
