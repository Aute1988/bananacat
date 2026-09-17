/**
 * NotificationService - Discord + Telegram 通知服务
 *
 * 支持的事件:
 *  - new_token: 新代币被创建
 *  - graduation: 代币从联合曲线毕业到 DEX
 *  - large_trade: 大笔交易(超过阈值的 buy/sell)
 *  - lock_burn: LP 被销毁(强信任事件)
 *
 * 支持的平台:
 *  - Discord: webhook URL
 *  - Telegram: Bot API + chat_id
 */
import { query } from './db.js'
import pino from 'pino'

const log = pino({ transport: { target: 'pino-pretty' } })

interface NewTokenEvent {
  type: 'new_token'
  chainId: number
  chainName: string
  tokenAddress: string
  tokenName: string
  tokenSymbol: string
  creatorAddress: string
  lockPeriod: number
  explorerUrl: string
}

interface GraduationEvent {
  type: 'graduation'
  chainId: number
  chainName: string
  tokenAddress: string
  tokenName: string
  tokenSymbol: string
  nativeContributed: string
  explorerUrl: string
}

interface LargeTradeEvent {
  type: 'large_trade'
  chainId: number
  chainName: string
  tokenAddress: string
  tokenSymbol: string
  tradeType: 'buy' | 'sell'
  amount: string       // token amount
  currencyAmount: string  // platform币
  traderAddress: string
  txHash: string
  explorerUrl: string
}

interface LockBurnEvent {
  type: 'lock_burn'
  chainId: number
  chainName: string
  tokenAddress: string
  tokenName: string
  tokenSymbol: string
  creatorAddress: string
  lpAmount: string
  explorerUrl: string
}

type NotifyEvent = NewTokenEvent | GraduationEvent | LargeTradeEvent | LockBurnEvent

/**
 * 发送一个事件到所有订阅者(并发)
 */
export async function dispatchEvent(event: NotifyEvent) {
  log.info({ eventType: event.type }, '分发通知事件')

  // 1) 查找所有订阅此事件的 webhook
  const subscriptions = await query<{
    id: number
    event_type: string
    target_type: 'discord' | 'telegram'
    target_url: string
  }>(
    `SELECT id, event_type, target_type, target_url
     FROM notification_subscriptions
     WHERE event_type = $1
       AND enabled = TRUE
       AND (chain_id IS NULL OR chain_id = $2)`,
    [event.type, event.chainId]
  )

  // 2) 构造不同平台的消息
  const message = renderMessage(event)

  // 3) 发送
  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      const eventId = getEventId(event)
      try {
        // 查重
        const exists = await query(
          `SELECT 1 FROM notification_history
           WHERE event_type = $1 AND event_id = $2 AND target_url = $3`,
          [event.type, eventId, sub.target_url]
        )
        if (exists.length > 0) return // 已发过

        if (sub.target_type === 'discord') {
          await sendDiscord(sub.target_url, message)
        } else {
          await sendTelegram(sub.target_url, message)
        }

        await query(
          `INSERT INTO notification_history (event_type, event_id, chain_id, target_type, target_url, status)
           VALUES ($1, $2, $3, $4, $5, 'success')`,
          [event.type, eventId, event.chainId, sub.target_type, sub.target_url]
        )
      } catch (err: any) {
        log.error({ err: err.message, sub: sub.id }, '通知发送失败')
        await query(
          `INSERT INTO notification_history (event_type, event_id, chain_id, target_type, target_url, status, error_message)
           VALUES ($1, $2, $3, $4, $5, 'failed', $6)`,
          [event.type, eventId, event.chainId, sub.target_type, sub.target_url, err.message]
        )
      }
    })
  )
}

function getEventId(event: NotifyEvent): string {
  switch (event.type) {
    case 'new_token': return event.tokenAddress
    case 'graduation': return event.tokenAddress + '_grad'
    case 'large_trade': return event.txHash
    case 'lock_burn': return event.tokenAddress + '_burn'
  }
}

/**
 * 渲染通用消息体(平台无关)
 * @internal 暴露给测试用
 */
export function renderMessage(event: NotifyEvent) {
  switch (event.type) {
    case 'new_token':
      return {
        title: `🍌🐱 新代币: ${event.tokenName} (${event.tokenSymbol})`,
        description:
          `链: ${event.chainName}\n` +
          `创建者: \`${event.creatorAddress.slice(0,6)}...${event.creatorAddress.slice(-4)}\`\n` +
          `锁仓期限: ${lockPeriodLabel(event.lockPeriod)}\n` +
          `[查看代币](${event.explorerUrl}/address/${event.tokenAddress})`,
        color: 0xf59e0b,
      }
    case 'graduation':
      return {
        title: `🎓 代币毕业: ${event.tokenName} (${event.tokenSymbol})`,
        description:
          `链: ${event.chainName}\n` +
          `曲线积累: ${event.nativeContributed}\n` +
          `已迁移到 DEX 公开交易!\n` +
          `[查看交易](${event.explorerUrl}/address/${event.tokenAddress})`,
        color: 0x10b981,
      }
    case 'large_trade':
      return {
        title: `💰 大${event.tradeType === 'buy' ? '买' : '卖'}: ${event.tokenSymbol}`,
        description:
          `链: ${event.chainName}\n` +
          `数量: ${event.amount}\n` +
          `金额: ${event.currencyAmount}\n` +
          `交易者: \`${event.traderAddress.slice(0,6)}...${event.traderAddress.slice(-4)}\`\n` +
          `[查看交易](${event.explorerUrl}/tx/${event.txHash})`,
        color: event.tradeType === 'buy' ? 0x22c55e : 0xef4444,
      }
    case 'lock_burn':
      return {
        title: `🔥 LP 销毁: ${event.tokenName} (${event.tokenSymbol})`,
        description:
          `链: ${event.chainName}\n` +
          `创建者: \`${event.creatorAddress.slice(0,6)}...${event.creatorAddress.slice(-4)}\`\n` +
          `销毁 LP 数量: ${event.lpAmount}\n` +
          `**这是对买家的最强信任承诺!** 💪`,
        color: 0xef4444,
      }
  }
}

function lockPeriodLabel(p: number): string {
  // 0=无锁,1=1天,2=7天,3=30天,4=365天,5=永久销毁
  return ['无锁', '1 天', '7 天', '30 天', '365 天', '永久销毁 🔥'][p] || '未知'
}

// ============================================================
// Discord
// ============================================================

async function sendDiscord(webhookUrl: string, msg: { title: string; description: string; color: number }) {
  const payload = {
    embeds: [{
      title: msg.title,
      description: msg.description,
      color: msg.color,
      timestamp: new Date().toISOString(),
      footer: { text: '🍌🐱 香蕉猫 Launchpad' },
    }],
  }

  // 🆕 修复 M-14: 加 8 秒超时,避免 webhook 慢导致事件分发卡死
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 8_000)
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    if (!res.ok) {
      throw new Error(`Discord ${res.status}: ${await res.text()}`)
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

// ============================================================
// Telegram
// ============================================================

async function sendTelegram(botToken: string, msg: { title: string; description: string }) {
  // botToken 字段约定: "BOT_TOKEN|CHAT_ID"
  const [token, chatId] = botToken.split('|')
  if (!token || !chatId) throw new Error('Telegram 配置格式错误,应为 BOT_TOKEN|CHAT_ID')

  const text = `*${msg.title}*\n\n${msg.description.replace(/`/g, '')}`
  const url = `https://api.telegram.org/bot${token}/sendMessage`

  // 🆕 修复 M-14: 加 8 秒超时
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 8_000)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      throw new Error(`Telegram ${res.status}: ${await res.text()}`)
    }
  } finally {
    clearTimeout(timeoutId)
  }
}
