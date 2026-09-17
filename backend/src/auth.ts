/**
 * SIWE-style 钱包签名验证中间件
 *
 * 设计:
 *   - 客户端用钱包签一段消息(包含 nonce + timestamp)
 *   - 服务端用 viem recoverMessageAddress 验证签名者是否是 userAddress
 *   - nonce 一次性使用,存内存或 Redis(此处用内存简化)
 *
 * 修复 H-4: 之前 userAddress 完全信任客户端,任何人都能冒充发评论/刷点赞/删别人的评论
 *
 * 用法:
 *   router.post('/comments', authMiddleware, handler)
 *   handler 中通过 req.userAddress 获取已验证地址(一定 = 签名者)
 */
import { Request, Response, NextFunction } from 'express'
import { recoverMessageAddress, isAddress } from 'viem'
import pino from 'pino'

const log = pino({ transport: { target: 'pino-pretty' } })

// nonce 存储(生产用 Redis)
const usedNonces = new Map<string, number>()  // nonce → expiresAt (ms)
const NONCE_TTL_MS = 5 * 60 * 1000  // 5 分钟

// 定期清理过期 nonce
setInterval(() => {
  const now = Date.now()
  for (const [nonce, expiresAt] of usedNonces) {
    if (now > expiresAt) usedNonces.delete(nonce)
  }
}, 60_000)

export interface AuthedRequest extends Request {
  userAddress?: string
}

/**
 * 中间件:验证客户端提交的 SIWE 风格签名
 *
 * 请求头:
 *   x-user-address: 0x... (钱包地址)
 *   x-signature: 0x... (对 message 的签名)
 *   x-message: "BananaCat\nNonce:xxx\nTimestamp:xxx" (被签名的原文)
 */
export async function authMiddleware(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  const userAddress = req.headers['x-user-address'] as string | undefined
  const signature = req.headers['x-signature'] as string | undefined
  const message = req.headers['x-message'] as string | undefined

  if (!userAddress || !signature || !message) {
    return res.status(401).json({
      error: '需要 x-user-address, x-signature, x-message 三个 header',
    })
  }

  if (!isAddress(userAddress, { strict: false })) {
    return res.status(400).json({ error: 'userAddress 不是合法以太坊地址' })
  }

  // 校验 message 格式,提取 nonce + timestamp
  const nonceMatch = message.match(/Nonce:([a-zA-Z0-9_-]+)/)
  const timestampMatch = message.match(/Timestamp:(\d+)/)
  if (!nonceMatch || !timestampMatch) {
    return res.status(400).json({
      error: 'message 格式错误,必须包含 Nonce: 和 Timestamp:',
    })
  }

  const nonce = nonceMatch[1]
  const timestamp = parseInt(timestampMatch[1], 10)
  const now = Date.now()

  // 防重放:nonce 必须未被用过
  if (usedNonces.has(nonce)) {
    return res.status(401).json({ error: 'Nonce 已使用过' })
  }
  // 防重放:timestamp 必须在 5 分钟内
  if (Math.abs(now - timestamp) > NONCE_TTL_MS) {
    return res.status(401).json({ error: '签名已过期(超过 5 分钟)' })
  }

  // 验证签名
  try {
    // 🆕 使用 recoverMessageAddress 还原签名者地址(v1.0+ API)
    const recovered = await recoverMessageAddress({
      message,
      signature: signature as `0x${string}`,
    })
    if (recovered.toLowerCase() !== userAddress.toLowerCase()) {
      log.warn({ recovered, claimed: userAddress }, '签名验证失败:地址不匹配')
      return res.status(401).json({ error: '签名与 userAddress 不匹配' })
    }
    // 标记 nonce 已用
    usedNonces.set(nonce, now + NONCE_TTL_MS)
    // 把验证过的地址挂到 req 上,handler 必须用这个值
    req.userAddress = recovered.toLowerCase()
    next()
  } catch (err: any) {
    log.warn({ err: err.message }, '签名验证异常')
    return res.status(401).json({ error: '签名验证失败: ' + err.message })
  }
}

/**
 * 生成签名挑战(前端用钱包签这个)
 *
 * 返回 message 原文 + nonce + timestamp
 * 前端需要:
 *   1. 调用此接口拿 message
 *   2. 用钱包 signMessage 签名
 *   3. 在写操作请求里带 x-message + x-signature + x-user-address
 */
export function generateChallenge(address: string): {
  message: string
  nonce: string
  timestamp: number
} {
  if (!isAddress(address, { strict: false })) {
    throw new Error('Invalid address')
  }
  // 32 字符随机 nonce
  const nonce =
    Math.random().toString(36).slice(2, 14) +
    Math.random().toString(36).slice(2, 14) +
    Math.random().toString(36).slice(2, 8)
  const timestamp = Date.now()
  const message = [
    '🍌🐱 香蕉猫 Launchpad',
    `Address: ${address}`,
    `Nonce: ${nonce}`,
    `Timestamp: ${timestamp}`,
    '',
    'Sign in to post comments / vote / subscribe.',
  ].join('\n')
  return { message, nonce, timestamp }
}
