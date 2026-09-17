/**
 * notificationService 单元测试
 * 覆盖:lockPeriodLabel 索引、renderMessage 渲染
 */
import { describe, it, expect, vi } from 'vitest'

// mock db,避免实际依赖
vi.mock('../src/db.js', () => ({
  query: async () => [],
}))

const { renderMessage } = await import('../src/notificationService.js') as any

describe('lockPeriodLabel', () => {
  // 通过 renderMessage new_token 间接测试
  function getLockLabel(period: number): string {
    const msg = renderMessage({
      type: 'new_token',
      chainId: 97,
      chainName: 'BSC Testnet',
      tokenAddress: '0xtoken',
      tokenName: 'BCAT',
      tokenSymbol: 'BCAT',
      creatorAddress: '0xuser',
      lockPeriod: period,
      explorerUrl: 'https://testnet.bscscan.com',
    })
    return msg.description
  }

  it('period 0 = 无锁', () => {
    expect(getLockLabel(0)).toContain('无锁')
  })
  it('period 1 = 1 天', () => {
    expect(getLockLabel(1)).toContain('1 天')
  })
  it('period 2 = 7 天', () => {
    expect(getLockLabel(2)).toContain('7 天')
  })
  it('period 3 = 30 天', () => {
    expect(getLockLabel(3)).toContain('30 天')
  })
  it('period 4 = 365 天', () => {
    expect(getLockLabel(4)).toContain('365 天')
  })
  it('period 5 = 永久销毁', () => {
    expect(getLockLabel(5)).toContain('永久销毁')
  })
  it('超出范围 = 未知', () => {
    expect(getLockLabel(99)).toContain('未知')
  })
})

describe('renderMessage new_token', () => {
  it('包含完整字段', () => {
    const msg = renderMessage({
      type: 'new_token',
      chainId: 97,
      chainName: 'BSC Testnet',
      tokenAddress: '0xtoken',
      tokenName: 'BCAT',
      tokenSymbol: 'BCAT',
      creatorAddress: '0x1234567890abcdef1234567890abcdef12345678',
      lockPeriod: 5,
      explorerUrl: 'https://testnet.bscscan.com',
    })
    expect(msg.title).toContain('新代币')
    expect(msg.title).toContain('BCAT')
    expect(msg.description).toContain('BSC Testnet')
    expect(msg.description).toContain('0x1234...5678')  // 短地址 slice(0,6)
    expect(msg.color).toBe(0xf59e0b)
  })
})

describe('renderMessage graduation', () => {
  it('迁移到 DEX 文案', () => {
    const msg = renderMessage({
      type: 'graduation',
      chainId: 97,
      chainName: 'BSC Testnet',
      tokenAddress: '0xtoken',
      tokenName: 'BCAT',
      tokenSymbol: 'BCAT',
      nativeContributed: '100000000000000000',  // 0.1 native
      explorerUrl: 'https://testnet.bscscan.com',
    })
    expect(msg.title).toContain('毕业')
    expect(msg.description).toContain('DEX')
    expect(msg.color).toBe(0x10b981)
  })
})

describe('renderMessage large_trade', () => {
  it('买入 = 绿色', () => {
    const msg = renderMessage({
      type: 'large_trade',
      chainId: 97,
      chainName: 'BSC Testnet',
      tokenAddress: '0xtoken',
      tokenSymbol: 'BCAT',
      tradeType: 'buy',
      amount: '1000000',
      currencyAmount: '50000000000000000',
      traderAddress: '0x1234567890abcdef1234567890abcdef12345678',
      txHash: '0xtx',
      explorerUrl: 'https://testnet.bscscan.com',
    })
    expect(msg.title).toContain('大买')
    expect(msg.color).toBe(0x22c55e)
  })
  it('卖出 = 红色', () => {
    const msg = renderMessage({
      type: 'large_trade',
      chainId: 97,
      chainName: 'BSC Testnet',
      tokenAddress: '0xtoken',
      tokenSymbol: 'BCAT',
      tradeType: 'sell',
      amount: '1000000',
      currencyAmount: '50000000000000000',
      traderAddress: '0x1234567890abcdef1234567890abcdef12345678',
      txHash: '0xtx',
      explorerUrl: 'https://testnet.bscscan.com',
    })
    expect(msg.title).toContain('大卖')
    expect(msg.color).toBe(0xef4444)
  })
})

describe('renderMessage lock_burn', () => {
  it('LP 销毁强信任事件', () => {
    const msg = renderMessage({
      type: 'lock_burn',
      chainId: 97,
      chainName: 'BSC Testnet',
      tokenAddress: '0xtoken',
      tokenName: 'BCAT',
      tokenSymbol: 'BCAT',
      creatorAddress: '0x1234567890abcdef1234567890abcdef12345678',
      lpAmount: '50000000000000000000',
      explorerUrl: 'https://testnet.bscscan.com',
    })
    expect(msg.title).toContain('LP')
    expect(msg.description).toContain('销毁')
    expect(msg.description).toContain('信任')
    expect(msg.color).toBe(0xef4444)
  })
})
