import { createPublicClient, http, PublicClient, getContract, defineChain } from 'viem'
import { bsc, sepolia, baseSepolia } from 'viem/chains'
import { env } from './config.js'
import pino from 'pino'

const log = pino({ transport: { target: 'pino-pretty' } })

// 🆕 本地 Anvil 测试链
const anvilLocal = defineChain({
  id: 31337,
  name: 'Anvil Local',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['http://localhost:8545'] },
  },
  testnet: true,
})

// 🆕 自定义链(viem 没有内置的)
const robinhoodTestnet = defineChain({
  id: 46630,
  name: 'Robinhood Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [env.ROBINHOOD_RPC] },
  },
  blockExplorers: {
    default: { name: 'RobinhoodScan', url: 'https://testnet-explorer.robinhood.com' },
  },
  testnet: true,
})

const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: {
    default: { http: [env.ARC_RPC] },
  },
  blockExplorers: {
    default: { name: 'ArcScan', url: 'https://testnet-explorer.arc.io' },
  },
  testnet: true,
})

// 🆕 Base Sepolia chain definition (viem baseSepolia 已内置,但需要 RPC override)
const baseSepoliaChain = defineChain({
  id: 84532,
  name: 'Base Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [env.BASE_RPC] },
  },
  blockExplorers: {
    default: { name: 'BaseScan', url: 'https://sepolia.basescan.org' },
  },
  testnet: true,
})

// 工厂 ABI(只关注事件) - 严格匹配 v2 合约事件
export const FACTORY_ABI = [
  {
    type: 'event',
    name: 'TokenCreated',
    inputs: [
      { name: 'token', type: 'address', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'name', type: 'string' },
      { name: 'symbol', type: 'string' },
      { name: 'label', type: 'uint8' },
      { name: 'mode', type: 'uint8' },
      { name: 'lockPeriod', type: 'uint8' },
      { name: 'maxBuyPerWallet', type: 'uint256' },
      { name: 'launchTime', type: 'uint256' },
      { name: 'tokenIndex', type: 'uint256', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'CurveGraduated',
    inputs: [
      { name: 'token', type: 'address', indexed: true },
      { name: 'migrator', type: 'address', indexed: true },
      { name: 'nativeContributed', type: 'uint256' },
      { name: 'lockPeriod', type: 'uint8' },
    ],
  },
] as const

// 曲线 ABI
export const CURVE_ABI = [
  {
    type: 'event',
    name: 'Buy',
    inputs: [
      { name: 'buyer', type: 'address', indexed: true },
      { name: 'tokenOut', type: 'uint256' },
      { name: 'currencyIn', type: 'uint256' },
      { name: 'fee', type: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'Sell',
    inputs: [
      { name: 'seller', type: 'address', indexed: true },
      { name: 'tokenIn', type: 'uint256' },
      { name: 'currencyOut', type: 'uint256' },
      { name: 'fee', type: 'uint256' },
    ],
  },
] as const

// LP 锁仓 ABI
export const LOCKER_ABI = [
  {
    type: 'event',
    name: 'LPLocked',
    inputs: [
      { name: 'lockId', type: 'bytes32', indexed: true },
      { name: 'token', type: 'address', indexed: true },  // 🆕 v4: LP token address (PancakeSwap pair)
      { name: 'creator', type: 'address', indexed: true },
      { name: 'lpAmount', type: 'uint256' },
      { name: 'period', type: 'uint8' },
      { name: 'unlockTimestamp', type: 'uint64' },
      { name: 'tokenOriginal', type: 'address' },         // 🆕 v4: 原代币地址
    ],
  },
  {
    type: 'event',
    name: 'LPClaimed',
    inputs: [
      { name: 'lockId', type: 'bytes32', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'lpAmount', type: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'LPBurned',
    inputs: [
      { name: 'lockId', type: 'bytes32', indexed: true },
      { name: 'lpAmount', type: 'uint256' },
    ],
  },
] as const

export type ChainConfig = {
  id: number
  name: string
  rpcUrl: string
  factoryAddress: `0x${string}`
}

export const CHAINS: ChainConfig[] = [
  { id: 31337, name: 'Anvil Local', rpcUrl: 'http://localhost:8545', factoryAddress: env.ANVIL_FACTORY as `0x${string}` || '0xCf7Ed3AccA5a467e9e704C703E8d87F634fB0Fc9' },
  { id: 97, name: 'BSC Testnet', rpcUrl: env.BSC_RPC, factoryAddress: env.BSC_FACTORY as `0x${string}` },
  { id: 11155111, name: 'Sepolia', rpcUrl: env.ETH_RPC, factoryAddress: env.ETH_FACTORY as `0x${string}` },
  { id: 46630, name: 'Robinhood Testnet', rpcUrl: env.ROBINHOOD_RPC, factoryAddress: env.ROBINHOOD_FACTORY as `0x${string}` },
  { id: 5042002, name: 'Arc Testnet', rpcUrl: env.ARC_RPC, factoryAddress: env.ARC_FACTORY as `0x${string}` },
  { id: 84532, name: 'Base Sepolia', rpcUrl: env.BASE_RPC, factoryAddress: env.BASE_FACTORY as `0x${string}` },
]

export async function createChainClient(chain: ChainConfig): Promise<PublicClient> {
  return createPublicClient({
    chain: chain.id === 31337 ? anvilLocal
      : chain.id === 97 ? bsc
      : chain.id === 11155111 ? sepolia
      : chain.id === 46630 ? robinhoodTestnet
      : chain.id === 5042002 ? arcTestnet
      : chain.id === 84532 ? baseSepoliaChain
      : undefined,
    transport: http(chain.rpcUrl),
  }) as PublicClient
}
