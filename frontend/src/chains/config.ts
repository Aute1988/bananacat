// 4条链的配置 + 全局常量
export type ChainType = 'bsc' | 'ethereum' | 'robinhood' | 'arc';

// TokenLabel 枚举(对应合约的 TokenLabel)
export const TOKEN_LABELS = [
  { value: 0, label: 'Meme', emoji: '🐸', color: 'text-green-400' },
  { value: 1, label: 'AI', emoji: '🤖', color: 'text-purple-400' },
  { value: 2, label: 'Defi', emoji: '💰', color: 'text-yellow-400' },
  { value: 3, label: 'Games', emoji: '🎮', color: 'text-pink-400' },
  { value: 4, label: 'Infra', emoji: '🛠️', color: 'text-blue-400' },
  { value: 5, label: 'De-Sci', emoji: '🔬', color: 'text-cyan-400' },
  { value: 6, label: 'Social', emoji: '💬', color: 'text-orange-400' },
  { value: 7, label: 'Depin', emoji: '📡', color: 'text-indigo-400' },
  { value: 8, label: 'Charity', emoji: '❤️', color: 'text-red-400' },
  { value: 9, label: 'Others', emoji: '✨', color: 'text-gray-400' },
] as const;

// 税率模式
export const TAX_MODES = [
  {
    value: 'normal',
    label: '普通模式 (Normal)',
    desc: '零税率 - 适合纯 Meme 代币,交易者最喜爱',
    emoji: '🚀',
  },
  {
    value: 'tax',
    label: '税率模式 (Tax Token)',
    desc: '可设置买入/卖出/转账税率 - 高级功能',
    emoji: '💸',
  },
] as const;

// 税率可选档位(参考 four.meme)
export const FEE_RATE_OPTIONS = [1, 3, 5, 10] as const;

export interface ChainConfig {
  id: number;
  name: string;
  nameCn: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrl: string;
  blockExplorer: string;
  factoryAddress: string;
  lpLockerAddress: string;
  migratorAddress: string;
  dexRouter?: string;
  wNative?: string;
  graduationTarget: string;
  creationFee: string;
  faucet?: string;
  color: string;
  emoji: string;
}

export const CHAINS: Record<ChainType, ChainConfig> = {
  bsc: {
    id: 97,
    name: 'BNB Smart Chain',
    nameCn: 'BNB 链',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    rpcUrl: 'https://rpc.ankr.com/bsc_testnet_chapel',
    blockExplorer: 'https://testnet.bscscan.com',
    factoryAddress: '0x0000000000000000000000000000000000000000',
    lpLockerAddress: '0x0000000000000000000000000000000000000000',
    migratorAddress: '0x0000000000000000000000000000000000000000',
    graduationTarget: '24000000000000000000',
    creationFee: '5000000000000000',
    faucet: 'https://testnet.bnbchain.org/faucet-smart',
    color: '#F0B90B',
    emoji: '🔶',
  },
  ethereum: {
    id: 11155111,
    name: 'Ethereum',
    nameCn: '以太坊',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrl: 'https://rpc.sepolia.org',
    blockExplorer: 'https://sepolia.etherscan.io',
    factoryAddress: '0x0000000000000000000000000000000000000000',
    lpLockerAddress: '0x0000000000000000000000000000000000000000',
    migratorAddress: '0x0000000000000000000000000000000000000000',
    graduationTarget: '24000000000000000000',
    creationFee: '5000000000000000',
    faucet: 'https://sepoliafaucet.com',
    color: '#627EEA',
    emoji: '🔷',
  },
  robinhood: {
    id: 46630,
    name: 'Robinhood Chain',
    nameCn: 'Robinhood 链',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrl: 'https://rpc.testnet.chain.robinhood.com',
    blockExplorer: 'https://explorer.testnet.chain.robinhood.com',
    factoryAddress: '0x0000000000000000000000000000000000000000',
    lpLockerAddress: '0x0000000000000000000000000000000000000000',
    migratorAddress: '0x0000000000000000000000000000000000000000',
    graduationTarget: '24000000000000000000',
    creationFee: '5000000000000000',
    faucet: 'https://faucet.chain.robinhood.com',
    color: '#00D632',
    emoji: '🟢',
  },
  arc: {
    id: 5042002,
    name: 'Circle Arc',
    nameCn: 'Circle Arc',
    nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
    rpcUrl: 'https://rpc.testnet.arc.io',
    blockExplorer: 'https://testnet.arcscan.app',
    factoryAddress: '0x0000000000000000000000000000000000000000',
    lpLockerAddress: '0x0000000000000000000000000000000000000000',
    migratorAddress: '0x0000000000000000000000000000000000000000',
    graduationTarget: '24000000000000000',
    creationFee: '5000000000000000',
    faucet: 'https://faucet.circle.com',
    color: '#2775CA',
    emoji: '🌊',
  },
};

// 锁仓期限选项
export const LOCK_PERIOD_OPTIONS = [
  { value: '0', label: '无锁仓', emoji: '⚠️', color: 'text-yellow-400', desc: '随时可取,风险最高' },
  { value: '1', label: '1 天', emoji: '⏰', color: 'text-green-400', desc: '24 小时观察期' },
  { value: '2', label: '7 天', emoji: '📅', color: 'text-blue-400', desc: '一周锁仓' },
  { value: '3', label: '30 天', emoji: '🗓️', color: 'text-purple-400', desc: '一个月锁仓' },
  { value: '4', label: '365 天', emoji: '🔒', color: 'text-orange-400', desc: '一年锁仓' },
  { value: '5', label: '永久销毁 🔥', emoji: '💀', color: 'text-red-400', desc: 'LP 直接烧毁' },
] as const;

export const LOCK_PERIOD_LABELS: Record<number, string> = {
  0: '无锁仓',
  1: '1 天',
  2: '7 天',
  3: '30 天',
  4: '365 天',
  5: '永久销毁 🔥',
};

// 解锁后可选的操作(新)
export const UNLOCK_ACTIONS = [
  {
    value: 'claim',
    label: '提取 LP',
    emoji: '🟢',
    color: 'green',
    desc: '把 LP 提取到自己钱包,可以自己提供流动性或锁进其他平台',
    bgClass: 'bg-green-500/10 border-green-500/30',
  },
  {
    value: 'extend',
    label: '继续锁仓',
    emoji: '🔄',
    color: 'yellow',
    desc: '重新选一个期限(1天/7天/30天/365天/永久销毁),再次锁定 LP',
    bgClass: 'bg-yellow-500/10 border-yellow-500/30',
  },
  {
    value: 'burn',
    label: '销毁 LP 🔥',
    emoji: '💀',
    color: 'red',
    desc: '立即把 LP 永久销毁 — 这是对买家最强的信任承诺!',
    bgClass: 'bg-red-500/10 border-red-500/30',
  },
] as const;
