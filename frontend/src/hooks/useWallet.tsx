/**
 * 钱包 hook - 集成 wagmi
 *
 * 🆕 完整接入 wagmi + viem,提供:
 *   - address: 当前连接钱包地址
 *   - chain: 当前链(BSC/Sepolia/Robinhood/Arc)
 *   - isConnected: 是否已连接
 *   - connect / disconnect: wagmi 提供
 *   - switchChain: 切换链
 *   - signMessage: SIWE 签名用
 *
 * 注意: RainbowKit 的 ConnectButton 已经处理连接 UI,
 *       这个 hook 主要给业务组件用
 */
import { useAccount, useChainId, useDisconnect, useSwitchChain } from 'wagmi'
import { useSignMessage } from 'wagmi'
import { CHAINS, ChainType, ChainConfig } from '../chains/config'
import { SUPPORTED_CHAINS } from '../chains/wagmi'

/**
 * wagmi chainId → ChainType
 * 🆕 修复 B-10: 之前对未映射 chainId 返回 'bsc',用户在错链时资产全丢
 *              现在对未映射的链返回 null,迫使 app 切到支持的链
 */
function chainIdToType(chainId: number | undefined): ChainType | null {
  if (!chainId) return 'bsc'
  if (chainId === 97) return 'bsc'
  if (chainId === 11155111) return 'ethereum'
  if (chainId === 46630) return 'robinhood'
  if (chainId === 5042002) return 'arc'
  // 🆕 未知的链 → 让交易前自动切链
  return null
}

/**
 * ChainType → wagmi chainId
 */
export function typeToChainId(type: ChainType): number {
  return CHAINS[type].id
}

export function useWallet() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const chain = chainIdToType(chainId)
  const chainConfig: ChainConfig = chain ? CHAINS[chain] : (Object.values(CHAINS)[0] as ChainConfig)
  const { disconnect } = useDisconnect()
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain()
  const { signMessageAsync, isPending: isSigning } = useSignMessage()

  /**
   * 切换链(包装 switchChainAsync,抛错给调用方)
   */
  const switchChain = async (target: ChainType) => {
    try {
      await switchChainAsync({ chainId: typeToChainId(target) })
    } catch (err: any) {
      console.error('切换链失败:', err)
      throw err
    }
  }

  return {
    address: address ?? null,
    chain,
    chainConfig,
    isConnected,
    isConnecting: isSigning || isSwitching,
    isSwitching,
    connect: () => {},  // RainbowKit 提供连接 UI
    disconnect,
    switchChain,
    signMessageAsync,
  }
}

/**
 * SIWE 签名 hook
 *
 * 用于评论/投票/删除/订阅等需要鉴权的写操作
 *
 * 用法:
 *   const { signedFetch } = useSIWE()
 *   await signedFetch('/api/comments', { method: 'POST', body: { content, ... } })
 */
export function useSIWE() {
  const { address, signMessageAsync } = useWallet()

  /**
   * 拿签名挑战
   */
  const fetchChallenge = async (): Promise<{ message: string; nonce: string; timestamp: number }> => {
    const res = await fetch(`${import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE || 'http://localhost:3001'}/api/auth/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
    })
    if (!res.ok) throw new Error('获取签名挑战失败')
    return res.json()
  }

  /**
   * 发起签名请求(自动 SIWE 流程)
   *
   * 返回 fetch Response(已带上签名 header)
   */
  const signedFetch = async (path: string, init: RequestInit = {}): Promise<Response> => {
    if (!address) throw new Error('钱包未连接')

    // 1. 拿挑战
    const challenge = await fetchChallenge()

    // 2. 用户签名
    const signature = await signMessageAsync({ message: challenge.message })

    // 3. 发起请求(带签名 header)
    const headers = new Headers(init.headers)
    headers.set('x-user-address', address)
    headers.set('x-message', challenge.message)
    headers.set('x-signature', signature)
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }

    return fetch(`${import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE || 'http://localhost:3001'}${path}`, {
      ...init,
      headers,
    })
  }

  return { signedFetch, address }
}
