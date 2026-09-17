/**
 * 真实合约交互封装
 *
 * 🆕 修复 H-6: 之前所有合约交互都是 mock(setTimeout 2s + 随机 hash),用户以为成功
 *              但链上没动作。现在接入真实 viem 调用。
 *
 * 🆕 修复 B-13: 现在通过 wagmi 注入的 walletClient 调用,避免双 EIP-1193 provider 冲突
 *
 * 依赖:
 *   - wagmi 的 getWalletClient()(RainbowKit 接管 EIP-1193)
 *   - 已连接钱包
 */
import { encodeFunctionData, type Address, type Abi, type WalletClient } from 'viem'
import { CHAINS, ChainType } from '../chains/config'
import { SUPPORTED_CHAINS } from '../chains/wagmi'

export class ContractError extends Error {
  constructor(message: string, public code?: number) {
    super(message)
    this.name = 'ContractError'
  }
}

/**
 * Viem chain by chainType(每条链对应一个 viem chain 定义,用于 write 操作)
 */
import {
  bscTestnet,
  sepolia,
} from 'viem/chains'
import { createPublicClient, defineChain, http } from 'viem'

export const robinhoodTestnet = defineChain({
  id: 46630,
  name: 'Robinhood Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.testnet.chain.robinhood.com'] } },
  blockExplorers: { default: { name: 'Explorer', url: 'https://explorer.testnet.chain.robinhood.com' } },
  testnet: true,
})

export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.io'] } },
  blockExplorers: { default: { name: 'ArcScan', url: 'https://testnet.arcscan.app' } },
  testnet: true,
})

export function getViemChain(chainType: ChainType) {
  switch (chainType) {
    case 'bsc': return bscTestnet
    case 'ethereum': return sepolia
    case 'robinhood': return robinhoodTestnet
    case 'arc': return arcTestnet
  }
}

// ============================================================
// ABI 定义(集中管理,跟合约 v2 完全对齐)
// ============================================================

/**
 * Factory.createToken(TokenConfig) - v2 用 struct 单一参数
 */
export const FACTORY_ABI: Abi = [
  {
    name: 'createToken',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'config',
        type: 'tuple',
        components: [
          { name: 'name', type: 'string' },
          { name: 'symbol', type: 'string' },
          { name: 'description', type: 'string' },
          { name: 'imageUrl', type: 'string' },
          { name: 'websiteUrl', type: 'string' },
          { name: 'twitterUrl', type: 'string' },
          { name: 'telegramUrl', type: 'string' },
          { name: 'label', type: 'uint8' },
          { name: 'mode', type: 'uint8' },
          {
            name: 'taxConfig',
            type: 'tuple',
            components: [
              { name: 'buyTaxBps', type: 'uint16' },
              { name: 'sellTaxBps', type: 'uint16' },
              { name: 'transferTaxBps', type: 'uint16' },
              { name: 'taxRecipient', type: 'address' },
            ],
          },
          { name: 'maxBuyPerWallet', type: 'uint256' },
          { name: 'launchTime', type: 'uint256' },
          { name: 'lockPeriod', type: 'uint8' },
          {
            name: 'antiSniper',
            type: 'tuple',
            components: [
              { name: 'enabled', type: 'bool' },
              { name: 'startTaxBps', type: 'uint16' },
              { name: 'decrementBps', type: 'uint16' },
              { name: 'durationBlocks', type: 'uint16' },
            ],
          },
        ],
      },
    ],
    outputs: [
      { name: 'token', type: 'address' },
      { name: 'curve', type: 'address' },
    ],
  },
] as const

/**
 * BondingCurve.buy(minTokenOut) payable
 *       .sell(tokenAmount, minCurrencyOut)
 */
export const CURVE_ABI: Abi = [
  {
    name: 'buy',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'minTokenOut', type: 'uint256' }],
    outputs: [{ name: 'tokenOut', type: 'uint256' }],
  },
  {
    name: 'sell',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenAmount', type: 'uint256' },
      { name: 'minCurrencyOut', type: 'uint256' },
    ],
    outputs: [{ name: 'currencyOut', type: 'uint256' }],
  },
] as const

/**
 * LPLocker.claimLP / extendLock / burnLPByCreator
 * lockLP(lpToken, token, creator, lpAmount, period)
 */
export const LOCKER_ABI: Abi = [
  {
    name: 'lockLP',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'lpToken', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'creator', type: 'address' },
      { name: 'lpAmount', type: 'uint256' },
      { name: 'period', type: 'uint8' },
    ],
    outputs: [{ name: 'lockId', type: 'bytes32' }],
  },
  {
    name: 'claimLP',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'lockId', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'extendLock',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'oldLockId', type: 'bytes32' },
      { name: 'newPeriod', type: 'uint8' },
    ],
    outputs: [{ name: 'newLockId', type: 'bytes32' }],
  },
  {
    name: 'burnLPByCreator',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'lockId', type: 'bytes32' }],
    outputs: [],
  },
] as const

// ============================================================
// 调用封装(通过 wagmi 提供的 WalletClient,不直接连 EIP-1193)
// ============================================================

/**
 * 内部工具:等待 tx 收据
 */
async function waitForReceipt(
  walletClient: WalletClient,
  hash: `0x${string}`
): Promise<void> {
  if (!walletClient.chain) throw new Error('No chain context')
  const publicClient = createPublicClient({
    chain: walletClient.chain,
    transport: http(),
  })
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status === 'reverted') {
    throw new ContractError('Transaction reverted on chain')
  }
}

/**
 * 创建代币 - 通过 wagmi walletClient 真正调用合约(v2:TokenConfig struct)
 */
export async function createTokenOnChain(
  params: {
    name: string
    symbol: string
    description: string
    imageUrl: string
    websiteUrl: string
    twitterUrl: string
    telegramUrl: string
    label: number
    taxMode: 'normal' | 'tax'
    buyTaxBps: number
    sellTaxBps: number
    transferTaxBps: number
    taxRecipient: string
    maxBuyPerWallet: bigint
    launchTime: number
    antiSniperBlocks: number
    antiSniperStartBps: number
    lockPeriod: number
  },
  walletClient: WalletClient,
  factoryAddress: Address,
  chainType: ChainType
): Promise<string> {
  if (!walletClient.account) throw new ContractError('钱包未连接')

  const chain = getViemChain(chainType)
  const data = encodeFunctionData({
    abi: FACTORY_ABI,
    functionName: 'createToken',
    args: [
      {
        name: params.name,
        symbol: params.symbol,
        description: params.description,
        imageUrl: params.imageUrl,
        websiteUrl: params.websiteUrl,
        twitterUrl: params.twitterUrl,
        telegramUrl: params.telegramUrl,
        label: params.label,
        mode: params.taxMode === 'tax' ? 1 : 0,
        taxConfig: {
          buyTaxBps: params.buyTaxBps,
          sellTaxBps: params.sellTaxBps,
          transferTaxBps: params.transferTaxBps,
          taxRecipient: (params.taxRecipient as Address) || walletClient.account.address,
        },
        maxBuyPerWallet: params.maxBuyPerWallet,
        launchTime: BigInt(params.launchTime),
        lockPeriod: params.lockPeriod,
        antiSniper: {
          enabled: params.antiSniperBlocks > 0,
          startTaxBps: params.antiSniperStartBps,
          decrementBps: params.antiSniperBlocks > 0 ? 100 : 0,  // 默认每区块 -1%
          durationBlocks: params.antiSniperBlocks,
        },
      },
    ] as any,
  })

  const creationFee = BigInt('5000000000000000')  // 0.005 ETH/BNB

  const txHash = await walletClient.sendTransaction({
    account: walletClient.account,
    chain,
    to: factoryAddress,
    data,
    value: creationFee,
  })

  await waitForReceipt(walletClient, txHash)
  return txHash
}

/**
 * 买入代币(联合曲线)
 */
export async function buyTokenOnChain(
  walletClient: WalletClient,
  curveAddress: Address,
  minTokenOut: bigint,
  valueWei: bigint,
  chainType: ChainType
): Promise<string> {
  if (!walletClient.account) throw new ContractError('钱包未连接')
  const chain = getViemChain(chainType)
  const data = encodeFunctionData({
    abi: CURVE_ABI,
    functionName: 'buy',
    args: [minTokenOut],
  })
  const txHash = await walletClient.sendTransaction({
    account: walletClient.account,
    chain,
    to: curveAddress,
    data,
    value: valueWei,
  })
  await waitForReceipt(walletClient, txHash)
  return txHash
}

/**
 * 卖出代币
 */
export async function sellTokenOnChain(
  walletClient: WalletClient,
  curveAddress: Address,
  tokenAmount: bigint,
  minCurrencyOut: bigint,
  chainType: ChainType
): Promise<string> {
  if (!walletClient.account) throw new ContractError('钱包未连接')
  const chain = getViemChain(chainType)
  const data = encodeFunctionData({
    abi: CURVE_ABI,
    functionName: 'sell',
    args: [tokenAmount, minCurrencyOut],
  })
  const txHash = await walletClient.sendTransaction({
    account: walletClient.account,
    chain,
    to: curveAddress,
    data,
  })
  await waitForReceipt(walletClient, txHash)
  return txHash
}

/**
 * LP 锁操作:claim / extend / burn(通过 walletClient)
 */
export async function lpActionOnChain(
  walletClient: WalletClient,
  action: 'claim' | 'extend' | 'burn',
  lockerAddress: Address,
  lockId: string,
  newPeriod: number,
  chainType: ChainType
): Promise<string> {
  if (!walletClient.account) throw new ContractError('钱包未连接')
  const chain = getViemChain(chainType)

  let functionName: string
  let args: unknown[]
  if (action === 'claim') {
    functionName = 'claimLP'
    args = [lockId as `0x${string}`]
  } else if (action === 'extend') {
    functionName = 'extendLock'
    args = [lockId as `0x${string}`, newPeriod]
  } else {
    functionName = 'burnLPByCreator'
    args = [lockId as `0x${string}`]
  }

  const data = encodeFunctionData({
    abi: LOCKER_ABI,
    functionName,
    args,
  })

  const txHash = await walletClient.sendTransaction({
    account: walletClient.account,
    chain,
    to: lockerAddress,
    data,
  })
  await waitForReceipt(walletClient, txHash)
  return txHash
}
