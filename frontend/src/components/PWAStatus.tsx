/**
 * PWAStatus - 桌面 / 离线 / 更新 提示
 * 显示在右下角,不打扰用户
 */
import { useState } from 'react'
import { usePWA } from '../hooks/usePWA'

export default function PWAStatus() {
  const { canInstall, installApp, needUpdate, updateApp, isOffline } = usePWA()
  // 🆕 安装提示本地状态:用户关闭后本次会话不再显示
  const [installDismissed, setInstallDismissed] = useState(false)
  const showInstall = canInstall && !installDismissed

  return (
    <>
      {/* 🆕 更新提示 */}
      {needUpdate && (
        <div className="fixed top-4 right-4 z-50 banana-card p-4 max-w-sm animate-pulse">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🔄</span>
            <div className="flex-1">
              <p className="font-bold text-yellow-400">有新版本可用!</p>
              <p className="text-xs text-gray-400 mt-1">点击刷新即可使用最新功能</p>
              <button onClick={updateApp}
                className="mt-2 btn-banana py-1 px-3 text-xs">
                立即更新
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📡 离线提示 */}
      {isOffline && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-orange-500/10 border border-orange-500/30 px-4 py-2 rounded-full text-orange-400 text-sm flex items-center gap-2 shadow-lg">
          <span className="animate-pulse">📡</span>
          离线模式 · 部分功能不可用
        </div>
      )}

      {/* 🆕 安装提示(底部 banner) */}
      {showInstall && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-50 banana-card p-4 shadow-2xl border border-yellow-500/30">
          <div className="flex items-start gap-3">
            <span className="text-3xl">🍌</span>
            <div className="flex-1">
              <p className="font-bold text-white">加到桌面?</p>
              <p className="text-xs text-gray-400 mt-1">
                安装后可以像 App 一样从桌面启动,无需打开浏览器
              </p>
              <div className="flex gap-2 mt-3">
                <button onClick={installApp} className="btn-banana py-1.5 px-3 text-xs flex-1">
                  📥 安装
                </button>
                <button onClick={() => setInstallDismissed(true)} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white">
                  下次
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
