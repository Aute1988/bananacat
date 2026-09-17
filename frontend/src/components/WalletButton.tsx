import { useWallet } from '../hooks/useWallet'

export default function WalletButton() {
  const { address, connect, disconnect, isConnecting } = useWallet()

  if (isConnecting) {
    return (
      <button className="px-4 py-2 rounded-xl bg-banana-500/20 text-yellow-400 text-sm font-medium">
        连接中...
      </button>
    )
  }

  if (address) {
    const short = `${address.slice(0, 6)}...${address.slice(-4)}`
    return (
      <div className="flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          {short}
        </div>
        <button
          onClick={() => disconnect()}
          className="px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm hover:bg-red-500/20 transition-colors"
        >
          断开
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={connect}
      className="btn-banana text-sm py-2 px-4"
    >
      连接钱包
    </button>
  )
}
