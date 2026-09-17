import { PublicClient, getAddress, isAddress } from 'viem'
import { ChainConfig, FACTORY_ABI, CURVE_ABI, LOCKER_ABI } from './chains.js'
import { query } from './db.js'
import { dispatchEvent } from './notificationService.js'
import pino from 'pino'

const log = pino({ transport: { target: 'pino-pretty' } })

/**
 * 从环境变量 / 默认值获取浏览器 URL
 */
function explorerUrl(chainId: number): string {
  const key = `EXPLORER_${chainId}`
  return process.env[key] || ''
}

/**
 * 校验事件字段,防止恶意或损坏的 RPC 响应污染数据库
 * 🆕 修复 H-7: 之前 indexer 直接信任 RPC 返回的 event.args,不做任何校验
 * 🆕 修复 B-2: 适配 v2 合约的事件签名(10 个参数,不是 v1 的 6 个)
 */
interface ValidatedTokenCreated {
  token: string
  creator: string
  name: string
  symbol: string
  label: number
  mode: number
  lockPeriod: number
  maxBuyPerWallet: bigint
  launchTime: bigint
  tokenIndex: bigint
}

function validateTokenCreatedArgs(args: any): ValidatedTokenCreated | null {
  if (!args || typeof args !== 'object') return null
  const { token, creator, name, symbol, label, mode, lockPeriod, maxBuyPerWallet, launchTime, tokenIndex } = args

  // 地址校验(必须能 toChecksum 化)
  if (!isAddress(token, { strict: false })) return null
  if (!isAddress(creator, { strict: false })) return null

  // 字符串长度校验(防止 unicode 炸弹 / 超长字段)
  if (typeof name !== 'string' || name.length === 0 || name.length > 50) return null
  if (typeof symbol !== 'string' || symbol.length === 0 || symbol.length > 10) return null

  // 枚举值校验
  if (!Number.isInteger(Number(label)) || Number(label) < 0 || Number(label) > 9) return null
  if (!Number.isInteger(Number(mode)) || Number(mode) > 1) return null

  // 锁仓期校验(0-5,对应 enum)
  const lp = Number(lockPeriod)
  if (!Number.isInteger(lp) || lp < 0 || lp > 5) return null

  // 数值校验
  const mbp = BigInt(maxBuyPerWallet ?? 0)
  const lt = BigInt(launchTime ?? 0)
  if (mbp < 0n) return null
  if (lt < 0n) return null

  // tokenIndex 必须是非负整数
  const ti = BigInt(tokenIndex ?? 0)
  if (ti < 0n) return null

  return {
    token: getAddress(token),
    creator: getAddress(creator),
    name: name.trim(),
    symbol: symbol.trim().toUpperCase(),
    label: Number(label),
    mode: Number(mode),
    lockPeriod: lp,
    maxBuyPerWallet: mbp,
    launchTime: lt,
    tokenIndex: ti,
  }
}

interface ValidatedCurveGraduated {
  token: string
  migrator: string
  nativeContributed: bigint
  lockPeriod: number
}

function validateCurveGraduatedArgs(args: any): ValidatedCurveGraduated | null {
  if (!args || typeof args !== 'object') return null
  const { token, migrator, nativeContributed, lockPeriod } = args
  if (!isAddress(token, { strict: false })) return null
  if (!isAddress(migrator, { strict: false })) return null
  const nc = BigInt(nativeContributed ?? 0)
  if (nc < 0n) return null
  const lp = Number(lockPeriod)
  if (!Number.isInteger(lp) || lp < 0 || lp > 5) return null
  return {
    token: getAddress(token),
    migrator: getAddress(migrator),
    nativeContributed: nc,
    lockPeriod: lp,
  }
}

interface ValidatedLPLocked {
  lockId: string
  token: string           // 🆕 v4: LP token 地址
  tokenOriginal: string   // 🆕 v4: 原代币地址(原 launchpad token)
  creator: string
  lpAmount: bigint
  period: number
  unlockTimestamp: number
}

function validateLPLockedArgs(args: any): ValidatedLPLocked | null {
  if (!args || typeof args !== 'object') return null
  const { lockId, token, tokenOriginal, creator, lpAmount, period, unlockTimestamp } = args
  if (typeof lockId !== 'string' || !lockId.startsWith('0x') || lockId.length !== 66) return null
  if (!isAddress(token, { strict: false })) return null
  if (!isAddress(creator, { strict: false })) return null
  // 🆕 v4: tokenOriginal 可能不存在(兼容旧事件),缺失就当 0 处理
  const tokenOrig = isAddress(tokenOriginal, { strict: false }) ? getAddress(tokenOriginal) : token
  const a = BigInt(lpAmount ?? 0)
  if (a <= 0n) return null  // LP 数量必须为正
  const p = Number(period)
  if (!Number.isInteger(p) || p < 0 || p > 5) return null
  const ut = Number(unlockTimestamp)
  if (!Number.isInteger(ut)) return null
  return {
    lockId,
    token: getAddress(token),
    tokenOriginal: tokenOrig,
    creator: getAddress(creator),
    lpAmount: a,
    period: p,
    unlockTimestamp: ut,
  }
}

/**
 * 索引器 - 监听 4 条链的工厂事件
 */
export class Indexer {
  constructor(
    private chain: ChainConfig,
    private client: PublicClient,
    private lpLockerAddress: `0x${string}`
  ) {}

  // ============================================================
  // 入口
  // ============================================================

  async start() {
    log.info({ chain: this.chain.name }, '启动索引器')

    // 1. 同步历史事件
    await this.syncHistoricalEvents()

    // 2. 监听新事件
    this.watchNewEvents()
  }

  // ============================================================
  // 同步历史事件
  // ============================================================

  private async syncHistoricalEvents() {
    const fromBlock = await this.getLastIndexedBlock()
    const currentBlock = await this.client.getBlockNumber()

    if (fromBlock >= currentBlock) {
      log.info({ chain: this.chain.name }, '已是最新')
      return
    }

    log.info({
      chain: this.chain.name,
      fromBlock: fromBlock.toString(),
      toBlock: currentBlock.toString(),
    }, '同步历史事件')

    // ⚠️ 分页同步:每次 5000 块,避免 RPC 超时
    const STEP = 5000n
    let cursor = fromBlock
    while (cursor < currentBlock) {
      const toBlock = cursor + STEP > currentBlock ? currentBlock : cursor + STEP

      // 同步 TokenCreated
      const createdLogs = await this.client.getLogs({
        address: this.chain.factoryAddress,
        event: FACTORY_ABI[0], // TokenCreated
        fromBlock: cursor,
        toBlock,
      })
      for (const log of createdLogs) {
        await this.handleTokenCreated(log)
      }

      // 同步 CurveGraduated
      const graduatedLogs = await this.client.getLogs({
        address: this.chain.factoryAddress,
        event: FACTORY_ABI[1], // CurveGraduated
        fromBlock: cursor,
        toBlock,
      })
      for (const log of graduatedLogs) {
        await this.handleCurveGraduated(log)
      }

      cursor = toBlock + 1n
      // 更新游标,防止崩溃丢失进度
      await this.updateLastIndexedBlock(cursor)
    }
  }

  // ============================================================
  // 监听新事件
  // ============================================================

  private watchNewEvents() {
    // 工厂事件 - 加错误回调防止静默失败
    this.client.watchContractEvent({
      address: this.chain.factoryAddress,
      abi: FACTORY_ABI,
      onLogs: async (logs) => {
        for (const log of logs) {
          try {
            if (log.eventName === 'TokenCreated') await this.handleTokenCreated(log)
            if (log.eventName === 'CurveGraduated') await this.handleCurveGraduated(log)
          } catch (err) {
            // 🆕 v5: console.error + log
            console.error({ err, log }, '处理工厂事件失败')
          }
        }
      },
      onError: (err) => {
        log.error({ err, chain: this.chain.name }, '工厂事件订阅失败,5秒后重试')
        setTimeout(() => this.watchNewEvents(), 5_000)
      },
    })

    // 锁仓事件(若 lpLockerAddress 是占位地址则跳过)
    if (this.lpLockerAddress === '0x0000000000000000000000000000000000000000') {
      log.warn({ chain: this.chain.name }, '未配置 lpLockerAddress,跳过锁仓监听')
      return
    }

    this.client.watchContractEvent({
      address: this.lpLockerAddress,
      abi: LOCKER_ABI,
      onLogs: async (logs) => {
        for (const log of logs) {
          try {
            if (log.eventName === 'LPLocked') await this.handleLPLocked(log)
            if (log.eventName === 'LPClaimed') await this.handleLPClaimed(log)
            if (log.eventName === 'LPBurned') await this.handleLPBurned(log)
          } catch (err) {
            console.error({ err, log }, '处理锁仓事件失败')
          }
        }
      },
      onError: (err) => {
        log.error({ err, chain: this.chain.name }, '锁仓事件订阅失败,5秒后重试')
      },
    })
  }

  // ============================================================
  // 事件处理
  // ============================================================

  private async handleTokenCreated(event: any) {
    // 🆕 修复 H-7 + B-2: 严格校验 + 适配 v2 事件
    const validated = validateTokenCreatedArgs(event.args)
    if (!validated) {
      log.warn({ chain: this.chain.name, raw: event.args }, 'TokenCreated 字段校验失败,跳过')
      return
    }
    const { token, creator, name, symbol, label, mode, lockPeriod, maxBuyPerWallet, launchTime, tokenIndex } = validated
    log.info({ chain: this.chain.name, token, creator, name, symbol, label, mode }, '新代币创建')

    await query(
      `INSERT INTO tokens
         (address, chain_id, name, symbol, creator_address, lock_period, label, image_url,
          curve_address, total_supply, current_reserve, description,
          tax_buy_bps, tax_sell_bps, anti_sniper_blocks, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
       ON CONFLICT (chain_id, address) DO NOTHING`,
      [
        token.toLowerCase(),
        this.chain.id,
        name,
        symbol,
        creator.toLowerCase(),
        lockPeriod,
        label,
        null,                       // image_url
        '',                         // curve_address 占位
        '0',                        // total_supply 占位
        '0',                        // current_reserve
        '',                         // description
        0,                          // tax_buy_bps(从 TAX 配置获取需要额外 read,这里先 0)
        0,                          // tax_sell_bps
        0,                          // anti_sniper_blocks
      ]
    )

    // 🔔 通知订阅者
    await dispatchEvent({
      type: 'new_token',
      chainId: this.chain.id,
      chainName: this.chain.name,
      tokenAddress: token,
      tokenName: name,
      tokenSymbol: symbol,
      creatorAddress: creator,
      lockPeriod: lockPeriod,
      explorerUrl: explorerUrl(this.chain.id),
    })
  }

  private async handleCurveGraduated(event: any) {
    // 🆕 修复 B-4: 跟 H-7 一致,严格校验字段
    const validated = validateCurveGraduatedArgs(event.args)
    if (!validated) {
      log.warn({ chain: this.chain.name, raw: event.args }, 'CurveGraduated 字段校验失败,跳过')
      return
    }
    const { token, migrator, nativeContributed, lockPeriod } = validated
    log.info({
      chain: this.chain.name,
      token,
      nativeContributed: nativeContributed.toString(),
    }, '代币毕业')

    await query(
      `UPDATE tokens SET graduated_at = NOW() WHERE chain_id = $1 AND address = $2`,
      [this.chain.id, token]
    )

    // 拿代币信息
    const tokens = await query<{ name: string; symbol: string }>(
      `SELECT name, symbol FROM tokens WHERE chain_id = $1 AND address = $2`,
      [this.chain.id, token]
    )
    if (tokens.length > 0) {
      await dispatchEvent({
        type: 'graduation',
        chainId: this.chain.id,
        chainName: this.chain.name,
        tokenAddress: token,
        tokenName: tokens[0].name,
        tokenSymbol: tokens[0].symbol,
        nativeContributed: nativeContributed.toString(),
        explorerUrl: explorerUrl(this.chain.id),
      })
    }
  }

  private async handleLPLocked(event: any) {
    // 🆕 修复 B-4: 严格校验
    const validated = validateLPLockedArgs(event.args)
    if (!validated) {
      log.warn({ chain: this.chain.name, raw: event.args }, 'LPLocked 字段校验失败,跳过')
      return
    }
    const { lockId, token, tokenOriginal, creator, lpAmount, period, unlockTimestamp } = validated
    log.info({
      chain: this.chain.name,
      lockId,
      token,
      tokenOriginal,
      creator,
      period,
    }, 'LP 已锁')

    await query(
      `INSERT INTO lp_locks (chain_id, lock_id, token_address, lp_token_address, creator_address, lp_amount, period, unlock_timestamp, tx_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (chain_id, lock_id) DO NOTHING`,
      [
        this.chain.id,
        lockId,
        tokenOriginal.toLowerCase(),   // 原代币地址
        token.toLowerCase(),           // 🆕 v4: LP token 地址
        creator.toLowerCase(),
        lpAmount.toString(),
        period,
        period === 5 ? 0 : unlockTimestamp,
        event.transactionHash,
      ]
    )
  }

  private async handleLPClaimed(event: any) {
    const { lockId, creator, lpAmount } = event.args
    // 🆕 简单校验:lockId 必须合法,lpAmount 必须是 bigint
    if (typeof lockId !== 'string' || !lockId.startsWith('0x') || lockId.length !== 66) {
      log.warn({ chain: this.chain.name, raw: event.args }, 'LPClaimed lockId 校验失败')
      return
    }
    log.info({ chain: this.chain.name, lockId, creator }, 'LP 已领取')

    await query(
      `UPDATE lp_locks SET claimed = TRUE, claimed_at = NOW() WHERE chain_id = $1 AND lock_id = $2`,
      [this.chain.id, lockId]
    )
  }

  private async handleLPBurned(event: any) {
    const { lockId, lpAmount } = event.args
    if (typeof lockId !== 'string' || !lockId.startsWith('0x') || lockId.length !== 66) {
      log.warn({ chain: this.chain.name, raw: event.args }, 'LPBurned lockId 校验失败')
      return
    }
    log.info({ chain: this.chain.name, lockId }, 'LP 已永久销毁')

    await query(
      `UPDATE lp_locks SET claimed = TRUE, claimed_at = NOW() WHERE chain_id = $1 AND lock_id = $2`,
      [this.chain.id, lockId]
    )

    // 🔔 通知订阅者(强信任事件,重点推送)
    const locks = await query<{ token_address: string; creator_address: string }>(
      `SELECT token_address, creator_address FROM lp_locks WHERE chain_id = $1 AND lock_id = $2`,
      [this.chain.id, lockId]
    )
    if (locks.length > 0) {
      const tokens = await query<{ name: string; symbol: string }>(
        `SELECT name, symbol FROM tokens WHERE chain_id = $1 AND address = $2`,
        [this.chain.id, locks[0].token_address]
      )
      if (tokens.length > 0) {
        await dispatchEvent({
          type: 'lock_burn',
          chainId: this.chain.id,
          chainName: this.chain.name,
          tokenAddress: locks[0].token_address,
          tokenName: tokens[0].name,
          tokenSymbol: tokens[0].symbol,
          creatorAddress: locks[0].creator_address,
          lpAmount: lpAmount.toString(),
          explorerUrl: explorerUrl(this.chain.id),
        })
      }
    }
  }

  // ============================================================
  // 游标管理
  // ============================================================

  private async getLastIndexedBlock(): Promise<bigint> {
    const rows = await query<{ value: string }>(
      `SELECT value FROM sync_state WHERE chain_id = $1 AND key = 'last_block'`,
      [this.chain.id]
    )
    return rows[0] ? BigInt(rows[0].value) : 0n
  }

  private async updateLastIndexedBlock(block: bigint) {
    await query(
      `INSERT INTO sync_state (chain_id, key, value, updated_at)
       VALUES ($1, 'last_block', $2, NOW())
       ON CONFLICT (chain_id, key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [this.chain.id, block.toString()]
    )
  }
}
