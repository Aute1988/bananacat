/**
 * 图表数据 Hook - 从后端拉蜡烛数据
 */
import { useQuery } from '@tanstack/react-query'

export type CandleInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d'

export interface Candle {
  open_time: string
  open_price: string
  high_price: string
  low_price: string
  close_price: string
  volume: string
  trade_count: number
  market_cap: string | null
}

export interface TokenStats {
  change24h: { change: number; current: number; previous: number } | null
  volume24h: string
  trades24h: number
  volumeAll: string
  tradesAll: number
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

async function fetchCandles(
  chainId: number,
  address: string,
  interval: CandleInterval,
  limit = 100
): Promise<Candle[]> {
  const res = await fetch(
    `${API_BASE}/api/tokens/${chainId}/${address}/candles?interval=${interval}&limit=${limit}`
  )
  if (!res.ok) throw new Error('拉蜡烛数据失败')
  const data = await res.json()
  return data.candles
}

async function fetchStats(chainId: number, address: string): Promise<TokenStats> {
  const res = await fetch(`${API_BASE}/api/tokens/${chainId}/${address}/stats`)
  if (!res.ok) throw new Error('拉统计数据失败')
  return res.json()
}

export function useCandles(
  chainId: number | undefined,
  address: string | undefined,
  interval: CandleInterval
) {
  return useQuery({
    queryKey: ['candles', chainId, address, interval],
    queryFn: () => fetchCandles(chainId!, address!, interval),
    enabled: !!(chainId && address),
    refetchInterval: 30_000, // 30 秒刷新
    staleTime: 10_000,
  })
}

export function useTokenStats(chainId: number | undefined, address: string | undefined) {
  return useQuery({
    queryKey: ['stats', chainId, address],
    queryFn: () => fetchStats(chainId!, address!),
    enabled: !!(chainId && address),
    refetchInterval: 30_000,
    staleTime: 10_000,
  })
}
