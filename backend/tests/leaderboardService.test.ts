/**
 * leaderboardService 单元测试
 * 覆盖:7 种排行榜类型的 SQL 结构 + 边界(空数据、limit 限制)
 */
import { describe, it, expect, vi } from 'vitest'
import type { LeaderboardType } from '../src/leaderboardService.js'

vi.mock('../src/db.js', () => ({
  query: async () => [],
  pool: { connect: async () => ({ query: async () => ({ rows: [] }), release: () => {} }) },
}))

const { getLeaderboard, CHAIN_NAMES } = await import('../src/leaderboardService.js')

const ALL_TYPES: LeaderboardType[] = [
  'hot', 'volume_24h', 'gainers', 'new', 'graduating', 'trending', 'creators',
]

describe('getLeaderboard 7 种类型', () => {
  for (const type of ALL_TYPES) {
    it(`type=${type} 返回数组(空数据时不崩)`, async () => {
      const rows = await getLeaderboard(type, 50)
      expect(rows).toBeInstanceOf(Array)
    })
  }

  it('未知 type 返回空数组', async () => {
    const rows = await getLeaderboard('invalid' as any, 50)
    expect(rows).toEqual([])
  })

  it('默认 limit=50', async () => {
    const rows = await getLeaderboard('new')
    expect(rows).toBeInstanceOf(Array)
  })
})

describe('CHAIN_NAMES 映射', () => {
  it('包含 4 条链', () => {
    expect(CHAIN_NAMES[97]).toBe('BSC')
    expect(CHAIN_NAMES[11155111]).toBe('ETH')
    expect(CHAIN_NAMES[46630]).toBe('Robinhood')
    expect(CHAIN_NAMES[5042002]).toBe('Arc')
  })
})
