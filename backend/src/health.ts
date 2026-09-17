/**
 * 健康检查 + 指标端点
 *
 * GET /health      - 简单健康检查(liveness)
 * GET /health/ready - 就绪检查(readiness) - 检查 DB 连接
 * GET /metrics     - Prometheus 兼容指标
 */
import express, { Request, Response } from 'express'
import { query } from './db.js'
import { cache } from './cache.js'
import pino from 'pino'

const log = pino({ transport: { target: 'pino-pretty' } })

const startTime = Date.now()
let dbHealthy = true
let lastDbCheck = 0

/**
 * 简单健康检查
 */
export function livenessHandler(_req: Request, res: Response) {
  res.json({
    status: 'ok',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
  })
}

/**
 * 就绪检查 - 验证关键依赖(DB)
 */
export async function readinessHandler(_req: Request, res: Response) {
  // 每 10 秒最多检查一次 DB,避免健康检查风暴把 DB 打爆
  if (Date.now() - lastDbCheck > 10_000) {
    try {
      await query('SELECT 1')
      dbHealthy = true
    } catch (err: any) {
      dbHealthy = false
      log.error({ err: err.message }, 'DB 健康检查失败')
    } finally {
      lastDbCheck = Date.now()
    }
  }

  const isReady = dbHealthy
  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ready' : 'not_ready',
    checks: {
      database: dbHealthy ? 'ok' : 'down',
    },
    uptime: Math.floor((Date.now() - startTime) / 1000),
  })
}

/**
 * Prometheus 指标(文本格式)
 */
export function metricsHandler(_req: Request, res: Response) {
  const mem = process.memoryUsage()
  const lines = [
    '# HELP process_uptime_seconds 进程启动时间(秒)',
    `# TYPE process_uptime_seconds gauge`,
    `process_uptime_seconds ${Math.floor((Date.now() - startTime) / 1000)}`,
    '',
    '# HELP nodejs_heap_used_bytes Node.js 堆内存使用',
    '# TYPE nodejs_heap_used_bytes gauge',
    `nodejs_heap_used_bytes ${mem.heapUsed}`,
    '',
    '# HELP nodejs_heap_total_bytes Node.js 堆内存总量',
    '# TYPE nodejs_heap_total_bytes gauge',
    `nodejs_heap_total_bytes ${mem.heapTotal}`,
    '',
    '# HELP cache_size 当前缓存项数量',
    '# TYPE cache_size gauge',
    `cache_size ${cache.stats().size}`,
    '',
    '# HELP cache_max_size 缓存最大容量',
    '# TYPE cache_max_size gauge',
    `cache_max_size ${cache.stats().maxSize}`,
  ]

  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  res.send(lines.join('\n'))
}
