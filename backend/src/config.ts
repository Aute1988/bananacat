import { z } from 'zod'
import 'dotenv/config'

/**
 * 环境变量配置
 *
 * 必填字段(FACTORY 地址)给占位值,启动后会被日志警告,但程序不会崩
 * 真实部署需要在 .env 文件里填入正确的工厂合约地址
 */
// 用 preprocess 先给空字符串 / undefined 一个默认值,然后 regex 验证
// 这样占位地址不会触发 regex fail
const factoryAddr = z.preprocess(
  (v) => (typeof v === 'string' && v.length > 0 ? v : undefined),
  z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional()
)

const Env = z.object({
  PORT: z.coerce.number().default(3001),

  // 🆕 PGlite 数据目录(嵌入式 PG,无需外部服务)
  PGLITE_DATA_DIR: z.string().default('.pglite-data'),

  // 本地 Anvil 测试链
  ANVIL_RPC: z.string().default('http://localhost:8545'),
  ANVIL_FACTORY: factoryAddr.default('0xCf7Ed3AccA5a467e9e704C703E8d87F634fB0Fc9'),

  // 4 条链的 RPC + 工厂地址(用占位 0x000... 避免启动崩溃)
  BSC_RPC: z.string().default('https://rpc.ankr.com/bsc_testnet_chapel'),
  BSC_FACTORY: factoryAddr.default('0x0000000000000000000000000000000000000001'),

  ETH_RPC: z.string().default('https://rpc.sepolia.org'),
  ETH_FACTORY: factoryAddr.default('0x0000000000000000000000000000000000000002'),

  ROBINHOOD_RPC: z.string().default('https://rpc.testnet.chain.robinhood.com'),
  ROBINHOOD_FACTORY: factoryAddr.default('0x0000000000000000000000000000000000000003'),

  ARC_RPC: z.string().default('https://rpc.testnet.arc.io'),
  ARC_FACTORY: factoryAddr.default('0x0000000000000000000000000000000000000004'),

  // 🆕 Base Sepolia (chainId 84532) - user 选择的真实 testnet
  BASE_RPC: z.string().default('https://base-sepolia-rpc.publicnode.com'),
  BASE_FACTORY: factoryAddr.default('0x0000000000000000000000000000000000000005'),

  // 浏览器 URL(给通知用)
  EXPLORER_97: z.string().default('https://testnet.bscscan.com'),
  EXPLORER_11155111: z.string().default('https://sepolia.etherscan.io'),
  EXPLORER_46630: z.string().default('https://testnet-explorer.robinhood.com'),
  EXPLORER_5042002: z.string().default('https://testnet-explorer.arc.io'),
  EXPLORER_84532: z.string().default('https://sepolia.basescan.org'),

  // 大额交易阈值(用于 large_trade 通知)
  LARGE_TRADE_THRESHOLD_WEI: z.coerce.bigint().default(1000000000000000000n), // 1 native

  // 启动时是否要重头同步
  SYNC_FROM_BLOCK: z.coerce.bigint().default(0n),
})

/**
 * 延迟解析:在第一次访问时执行,而不是模块加载时
 * 这样测试可以先修改 process.env 再访问 env
 */
let _env: z.infer<typeof Env> | null = null

export function getEnv() {
  if (!_env) {
    _env = Env.parse(process.env)
    // 启动时校验:占位地址警告
    if (process.env.NODE_ENV !== 'test') {
      for (const chain of ['BSC', 'ETH', 'ROBINHOOD', 'ARC', 'BASE'] as const) {
        const addr = _env[`${chain}_FACTORY` as keyof typeof _env] as string
        if (addr.startsWith('0x000000000000000000000000000000000000000')) {
          console.warn(`⚠️  ${chain}_FACTORY 未配置,使用占位地址。生产环境请在 .env 中设置。`)
        }
      }
    }
  }
  return _env
}

/**
 * 重置缓存(测试用)
 */
export function resetEnv() {
  _env = null
}

/**
 * 向后兼容:导出 env(用 getter 强制重新解析)
 */
export const env = new Proxy({} as z.infer<typeof Env>, {
  get(_target, prop) {
    return getEnv()[prop as keyof typeof Env]
  },
})
