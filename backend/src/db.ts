import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import pino from 'pino'

const log = pino({ transport: { target: 'pino-pretty' } })

// 🆕 PGlite - 100% 兼容 PostgreSQL 的嵌入式数据库 (WASM)
// 优点: 零安装、零配置、与 PG SQL 100% 兼容 (包括 SERIAL, NUMERIC, BOOLEAN, ALTER IF NOT EXISTS)
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const dataDir = process.env.PGLITE_DATA_DIR || '.pglite-data'
const db = new PGlite(dataDir)

// 初始化 schema(在第一次启动时执行)
let initialized = false
async function initSchema(): Promise<void> {
  if (initialized) return
  const schemaPath = join(__dirname, '../db/schema.sql')
  try {
    let sql = readFileSync(schemaPath, 'utf-8')
    // 🆕 去掉 // 和 -- 注释行(PGlite 默认对 SQL 不解析 C 风格注释,需要预处理)
    sql = sql
      .split('\n')
      .map((line) => {
        const trimmed = line.trim()
        if (trimmed === '' || trimmed.startsWith('--') || trimmed.startsWith('//')) return ''
        return line
      })
      .join('\n')
    await db.exec(sql)
    log.info({ schemaPath }, '✅ PGlite schema 初始化成功')
    initialized = true
  } catch (err) {
    log.error({ err }, '❌ PGlite schema 初始化失败')
    throw err
  }
}

// 启动时立刻初始化
initSchema().catch((err) => {
  log.error({ err }, '致命错误: 无法初始化数据库 schema')
  process.exit(1)
})

/**
 * query - 等价于 pg 的 pool.query
 * 返回 rows 数组(向后兼容 backend 中所有调用方)
 */
export async function query<T = any>(text: string, params: any[] = []): Promise<T[]> {
  await initSchema()
  const result = await db.query<T>(text, params)
  return result.rows as T[]
}

/**
 * queryRaw - 返回 rows + rowCount(用于 UPDATE/DELETE)
 */
export async function queryRaw<T = any>(text: string, params: any[] = []): Promise<{
  rows: T[]
  rowCount: number
}> {
  await initSchema()
  const result = await db.query<T>(text, params)
  return {
    rows: result.rows as T[],
    rowCount: result.affectedRows ?? result.rows.length,
  }
}

/**
 * 关闭数据库连接(PGlite 自动管理,这里保留接口兼容)
 */
export async function closePool(): Promise<void> {
  await db.close()
}

export { db }
