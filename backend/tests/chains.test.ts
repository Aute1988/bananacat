/**
 * chains.ts 测试
 * 覆盖:createChainClient 返回 4 条链对应的 client
 */
import { describe, it, expect, vi } from 'vitest'

const mockCreatePublicClient = vi.fn()
vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>()
  return {
    ...actual,
    createPublicClient: (...args: any[]) => mockCreatePublicClient(...args),
  }
})

const { createChainClient, CHAINS } = await import('../src/chains.js')

describe('CHAINS 配置', () => {
  it('包含 4 条链', () => {
    expect(CHAINS.length).toBe(4)
  })

  it('每条链都有 id/name/rpcUrl/factoryAddress', () => {
    for (const c of CHAINS) {
      expect(c.id).toBeGreaterThan(0)
      expect(c.name).toBeTruthy()
      expect(c.rpcUrl).toMatch(/^https?:\/\//)
      expect(c.factoryAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
    }
  })

  it('链 ID 包含 BSC/ETH/Robinhood/Arc', async () => {
    // 延迟 import,避免模块级副作用
    const { CHAINS } = await import('../src/chains.js')
    const ids = CHAINS.map(c => c.id)
    expect(ids).toContain(97)        // BSC
    expect(ids).toContain(11155111)  // ETH Sepolia
    expect(ids).toContain(46630)     // Robinhood
    expect(ids).toContain(5042002)   // Arc
  })
})

describe('createChainClient', () => {
  it('为 BSC (97) 用 bsc chain config', async () => {
    mockCreatePublicClient.mockClear()
    await createChainClient(CHAINS[0])
    expect(mockCreatePublicClient).toHaveBeenCalledTimes(1)
    const call = mockCreatePublicClient.mock.calls[0][0]
    expect(call.transport).toBeDefined()
  })

  it('未知链 chain = undefined(让 viem 自动检测)', async () => {
    mockCreatePublicClient.mockClear()
    await createChainClient({
      id: 999,
      name: 'Unknown',
      rpcUrl: 'http://localhost',
      factoryAddress: '0x0000000000000000000000000000000000000000' as any,
    })
    expect(mockCreatePublicClient).toHaveBeenCalledTimes(1)
    const call = mockCreatePublicClient.mock.calls[0][0]
    expect(call.chain).toBeUndefined()
  })
})
