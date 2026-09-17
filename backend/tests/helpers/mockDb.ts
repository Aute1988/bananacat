/**
 * db 模块的 mock 版本(测试时替换 query/pool)
 *
 * 业务模块通过 `import { query } from './db.js'` 导入,
 * 在测试中用 `vi.mock('./db.js', () => mockDb(impl))` 注入实现
 */

export type QueryResult = any[]

export interface MockDbState {
  queryImpl?: (text: string, params: any[]) => Promise<QueryResult>
}

export function createMockDb(state: MockDbState = {}) {
  return {
    pool: {
      // 让 priceCandleService 拿到一个可 connect 的对象
      connect: async () => ({
        query: async () => ({ rows: [] }),
        release: () => {},
      }),
    },
    query: state.queryImpl ?? (async () => []),
    __state: state,
  }
}
