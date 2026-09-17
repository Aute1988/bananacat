/**
 * wagmi 配置 - RainbowKit 钱包连接
 *
 * 🆕 整合 wagmi + viem + RainbowKit,提供 EIP-6963 多钱包识别、
 *    钱包连接 UI、链切换等标准 Web3 体验
 *
 * 4 条测试链 + 本地 Anvil:
 *   - Anvil Local (31337)
 *   - BSC Testnet (97)
 *   - Sepolia (11155111)
 *   - Robinhood Chain Testnet (46630)
 *   - Circle Arc Testnet (5042002)
 */
import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { bscTestnet, sepolia } from 'wagmi/chains'
import { defineChain } from 'viem'

// Anvil 本地链
export const anvilLocal = defineChain({
  id: 31337,
  name: 'Anvil Local',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['http://localhost:8545'] },
  },
  testnet: true,
})

// 自定义测试链(Robinhood + Arc,主流 wagmi chains 没有)
export const robinhoodTestnet = defineChain({
  id: 46630,
  name: 'Robinhood Chain Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.chain.robinhood.com'] },
  },
  blockExplorers: {
    default: { name: 'Explorer', url: 'https://explorer.testnet.chain.robinhood.com' },
  },
  testnet: true,
})

export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.io'] },
  },
  blockExplorers: {
    default: { name: 'ArcScan', url: 'https://testnet.arcscan.app' },
  },
  testnet: true,
})

/**
 * wagmi 配置
 *
 * 注意: 在 production 中应该用环境变量注入 WC Project ID
 * 这里用占位符 'RAINBOWKIT_DEMO_PROJECT_ID'(RainbowKit 官方 demo 项目)
 * 部署到生产前必须替换
 */
export const wagmiConfig = getDefaultConfig({
  appName: '香蕉猫 Launchpad',
  projectId: import.meta.env.VITE_WC_PROJECT_ID || 'RAINBOWKIT_DEMO_PROJECT_ID',
  chains: [anvilLocal, bscTestnet, sepolia, robinhoodTestnet, arcTestnet],
  ssr: false,
})

export const SUPPORTED_CHAINS = wagmiConfig.chains
