import { env } from './config.js'
import { createChainClient, CHAINS } from './chains.js'
import { Indexer } from './indexer.js'
import { startCandleListener } from './priceCandleService.js'
import app from './api.js'
import pino from 'pino'

const log = pino({ transport: { target: 'pino-pretty' } })

async function main() {
  log.info('🍌🐱 香蕉猫后端启动中...')

  // 启动 API 服务器
  app.listen(env.PORT, () => {
    log.info({ port: env.PORT }, `API 服务器已启动: http://localhost:${env.PORT}`)
  })

  // 启动蜡烛聚合服务(每 5 秒扫描新交易)
  startCandleListener()

  // 启动 4 条链的索引器(自动跳过占位地址)
  for (const chain of CHAINS) {
    if (chain.factoryAddress.startsWith('0x000000000000000000000000000000000000000')) {
      log.warn({ chain: chain.name }, 'factory 未配置,跳过此链的索引器')
      continue
    }
    try {
      const client = await createChainClient(chain)
      const lpLockerAddress = '0x0000000000000000000000000000000000000000' as `0x${string}`
      const indexer = new Indexer(chain, client, lpLockerAddress)
      await indexer.start()
    } catch (err) {
      log.error({ err, chain: chain.name }, '索引器启动失败')
    }
  }
}

main().catch((err) => {
  log.error({ err }, '启动失败')
  process.exit(1)
})
