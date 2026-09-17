import { useState } from 'react'
import { CHAINS, ChainType } from '../chains/config'
import { useWallet } from '../hooks/useWallet'

export default function ChainSelector() {
  const { chain, chainConfig, switchChain } = useWallet()
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-dark-100 border border-white/10 hover:border-yellow-500/30 transition-all text-sm"
      >
        <span>{chainConfig.emoji}</span>
        <span className="text-gray-300 hidden sm:block">{chainConfig.nameCn}</span>
        <span className="text-xs text-gray-500">▼</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 w-56 bg-dark-100 border border-yellow-500/20 rounded-xl shadow-2xl overflow-hidden">
            {Object.entries(CHAINS).map(([key, config]) => (
              <button
                key={key}
                onClick={() => {
                  switchChain(key as ChainType)
                  setOpen(false)
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors ${
                  chain === key ? 'bg-banana-500/10 border-l-2 border-yellow-500' : ''
                }`}
              >
                <span className="text-xl">{config.emoji}</span>
                <div>
                  <div className="text-sm font-medium text-white">{config.nameCn}</div>
                  <div className="text-xs text-gray-500">{config.name}</div>
                </div>
                {chain === key && <span className="ml-auto text-yellow-400 text-xs">✓</span>}
              </button>
            ))}
            <div className="border-t border-white/5 px-4 py-2 text-xs text-gray-500">
              测试网模式 · 仅供演示
            </div>
          </div>
        </>
      )}
    </div>
  )
}
