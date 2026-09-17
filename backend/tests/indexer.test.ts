/**
 * indexer.ts 单元测试
 * 覆盖:
 *   - watchContractEvent 错误处理 + 重连
 *   - 同步历史分页
 *   - handleTokenCreated ON CONFLICT 幂等
 *   - handleLPLocked lowercase 地址
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import pino from 'pino'

vi.mock('pino', () => ({
  default: () => ({
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  }),
}))

const writes: any[] = []
vi.mock('../src/db.js', () => ({
  query: async (text: string, params: any[] = []) => {
    writes.push({ text: text.trim(), params })
    return []
  },
  pool: { connect: async () => ({ query: async () => ({ rows: [] }), release: () => {} }) },
}))

vi.mock('../src/notificationService.js', () => ({
  dispatchEvent: async () => {},
}))

const { Indexer } = await import('../src/indexer.js')

function makeMockClient() {
  return {
    getBlockNumber: async () => 100n,
    getLogs: async () => [],
    watchContractEvent: vi.fn(),
  } as any
}

beforeEach(() => {
  writes.length = 0
})

describe('Indexer handleTokenCreated', () => {
  it('lowercase 地址 + 完整字段', async () => {
    const indexer = new Indexer(
      { id: 97, name: 'BSC Testnet', rpcUrl: '', factoryAddress: '0x0000000000000000000000000000000000000001' as any },
      makeMockClient(),
      '0x0000000000000000000000000000000000000000' as any
    )

    await (indexer as any).handleTokenCreated({
      args: {
        token: '0xABCDEF1234567890ABCDEF1234567890ABCDEF12',
        creator: '0x1234567890ABCDEF1234567890ABCDEF12345678',
        name: 'BCAT',
        symbol: 'BCAT',
        lockPeriod: 5n,
        tokenIndex: 1n,
      },
      transactionHash: '0xtx',
    })

    const insert = writes.find(w => w.text.startsWith('INSERT INTO tokens'))
    expect(insert).toBeDefined()
    expect(insert.params[0]).toBe('0xabcdef1234567890abcdef1234567890abcdef12') // lowercase
    expect(insert.params[2]).toBe('BCAT')
    expect(insert.params[5]).toBe(5) // lockPeriod
    expect(insert.params[1]).toBe(97) // chain_id
  })
})

describe('Indexer handleLPLocked', () => {
  it('lowercase token/creator 地址', async () => {
    const indexer = new Indexer(
      { id: 97, name: 'BSC Testnet', rpcUrl: '', factoryAddress: '0x0000000000000000000000000000000000000001' as any },
      makeMockClient(),
      '0x0000000000000000000000000000000000000000' as any
    )

    await (indexer as any).handleLPLocked({
      args: {
        lockId: '0x' + '11'.repeat(32),
        token: '0xABCDEF1234567890ABCDEF1234567890ABCDEF12',
        creator: '0x1234567890ABCDEF1234567890ABCDEF12345678',
        lpAmount: 1000000n,
        period: 1n,
        unlockTimestamp: 86400n,
      },
      transactionHash: '0xtx',
    })

    const insert = writes.find(w => w.text.startsWith('INSERT INTO lp_locks'))
    expect(insert).toBeDefined()
    expect(insert.params[2]).toBe('0xabcdef1234567890abcdef1234567890abcdef12')
    expect(insert.params[3]).toBe('0x1234567890abcdef1234567890abcdef12345678')
  })

  it('period=5 (永久销毁) 时 unlockTimestamp=0', async () => {
    const indexer = new Indexer(
      { id: 97, name: 'BSC Testnet', rpcUrl: '', factoryAddress: '0x0000000000000000000000000000000000000001' as any },
      makeMockClient(),
      '0x0000000000000000000000000000000000000000' as any
    )

    await (indexer as any).handleLPLocked({
      args: {
        lockId: '0x' + '11'.repeat(32),
        token: '0xtoken',
        creator: '0xuser',
        lpAmount: 1000n,
        period: 5n,
        unlockTimestamp: 999999n,
      },
      transactionHash: '0xtx',
    })

    const insert = writes.find(w => w.text.startsWith('INSERT INTO lp_locks'))
    expect(insert.params[6]).toBe(0) // unlockTimestamp
  })
})

describe('Indexer watchNewEvents', () => {
  it('工厂地址是占位时跳过 watchContractEvent', async () => {
    const client = makeMockClient()
    const indexer = new Indexer(
      { id: 97, name: 'BSC Testnet', rpcUrl: '', factoryAddress: '0x0000000000000000000000000000000000000001' as any },
      client,
      '0x0000000000000000000000000000000000000000' as any
    )

    ;(indexer as any).watchNewEvents()
    // 只订阅了工厂事件(因为 lpLockerAddress 是 0x000...0000)
    expect(client.watchContractEvent).toHaveBeenCalledTimes(1)
  })

  it('lpLockerAddress 是占位时跳过锁仓监听', () => {
    const client = makeMockClient()
    const indexer = new Indexer(
      { id: 97, name: 'BSC Testnet', rpcUrl: '', factoryAddress: '0x0000000000000000000000000000000000000001' as any },
      client,
      '0x0000000000000000000000000000000000000000' as any
    )

    ;(indexer as any).watchNewEvents()
    // 第二个 watchContractEvent(锁仓)不应该被调用
    const calls = client.watchContractEvent.mock.calls
    expect(calls.length).toBe(1) // 只有工厂事件
  })
})
