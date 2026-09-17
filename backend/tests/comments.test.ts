/**
 * comments.ts 单元测试
 *
 * 覆盖:
 *   - voteComment 差量逻辑(撤销、切换、首次投票)
 *   - createComment 嵌套校验(跨代币 / 无限嵌套)
 *   - getCommentCount
 *   - deleteComment 权限
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// 用 in-memory table 模拟 DB
let tables: Record<string, any[]> = {
  token_comments: [],
  comment_votes: [],
}

function fakeQuery(text: string, params: any[] = []): Promise<any[]> {
  // 简单 SQL 分发器(只覆盖测试用例用到的 SQL)
  const t = text.trim()

  // SELECT 1 FROM token_comments WHERE id = $1 AND is_deleted = FALSE
  if (/^SELECT token_address, chain_id, parent_id FROM token_comments/i.test(t)) {
    const row = tables.token_comments.find(r => r.id === params[0] && !r.is_deleted)
    return Promise.resolve(row ? [{ token_address: row.token_address, chain_id: row.chain_id, parent_id: row.parent_id }] : [])
  }

  // INSERT INTO token_comments ... RETURNING *
  if (/^INSERT INTO token_comments/i.test(t)) {
    const [token_address, chain_id, user_address, content, parent_id] = params
    const row = {
      id: tables.token_comments.length + 1,
      token_address, chain_id, user_address, content, parent_id: parent_id ?? null,
      upvotes: 0, downvotes: 0, is_deleted: false,
      created_at: new Date(), updated_at: new Date(),
    }
    tables.token_comments.push(row)
    return Promise.resolve([row])
  }

  // SELECT vote_type FROM comment_votes WHERE comment_id = $1 AND user_address = $2
  if (/^SELECT vote_type FROM comment_votes/i.test(t)) {
    const row = tables.comment_votes.find(
      r => r.comment_id === params[0] && r.user_address === params[1]
    )
    return Promise.resolve(row ? [{ vote_type: row.vote_type }] : [])
  }

  // INSERT INTO comment_votes ... ON CONFLICT DO UPDATE
  if (/^INSERT INTO comment_votes/i.test(t)) {
    const [comment_id, user_address, vote_type] = params
    const existing = tables.comment_votes.find(
      r => r.comment_id === comment_id && r.user_address === user_address
    )
    if (existing) {
      existing.vote_type = vote_type
      existing.voted_at = new Date()
    } else {
      tables.comment_votes.push({ comment_id, user_address, vote_type, voted_at: new Date() })
    }
    return Promise.resolve([])
  }

  // UPDATE token_comments SET upvotes = GREATEST(0, upvotes + $2), downvotes = GREATEST(0, downvotes + $3)
  if (/UPDATE token_comments\s+SET upvotes = GREATEST/i.test(t)) {
    const [commentId, upDelta, downDelta] = params
    const row = tables.token_comments.find(r => r.id === commentId)
    if (row) {
      row.upvotes = Math.max(0, row.upvotes + (upDelta ?? 0))
      row.downvotes = Math.max(0, row.downvotes + (downDelta ?? 0))
    }
    return Promise.resolve([])
  }

  // UPDATE token_comments SET is_deleted = TRUE
  if (/UPDATE token_comments\s+SET is_deleted/i.test(t)) {
    const [commentId, userAddress] = params
    const row = tables.token_comments.find(r => r.id === commentId)
    if (!row) return Promise.resolve([])
    if (row.user_address !== userAddress) return Promise.resolve([])
    row.is_deleted = true
    return Promise.resolve([{ id: commentId }])
  }

  // SELECT COUNT(*) ... FROM token_comments
  if (/SELECT COUNT\(\*\)/i.test(t) && /FROM token_comments/i.test(t)) {
    const [tokenAddr, chainId] = params
    const cnt = tables.token_comments.filter(
      r => r.token_address === tokenAddr && r.chain_id === chainId && !r.is_deleted && r.parent_id === null
    ).length
    return Promise.resolve([{ count: cnt }])
  }

  // 默认:返回空
  return Promise.resolve([])
}

vi.mock('../src/db.js', () => ({
  query: fakeQuery,
  queryRaw: async (text: string, params: any[] = []) => {
    const rows = await fakeQuery(text, params)
    return { rows, rowCount: rows.length }
  },
  pool: { connect: async () => ({ query: async () => ({ rows: [] }), release: () => {} }) },
}))

const { createComment, voteComment, getCommentCount, deleteComment, getCommentsByToken } = await import('../src/comments.js')

beforeEach(() => {
  tables = { token_comments: [], comment_votes: [] }
})

describe('createComment', () => {
  it('创建顶层评论', async () => {
    const c = await createComment('0xtoken1', 97, '0xuser1', 'Hello world', undefined)
    expect(c.id).toBe(1)
    expect(c.content).toBe('Hello world')
    expect(c.parent_id).toBe(null)
    expect(c.upvotes).toBe(0)
  })

  it('创建对主评论的回复', async () => {
    const parent = await createComment('0xtoken1', 97, '0xuser1', 'Top comment', undefined)
    const reply = await createComment('0xtoken1', 97, '0xuser2', 'Reply', parent.id)
    expect(reply.parent_id).toBe(parent.id)
  })

  it('拒绝:父评论不存在', async () => {
    await expect(
      createComment('0xtoken1', 97, '0xuser1', 'reply', 999)
    ).rejects.toThrow('父评论不存在')
  })

  it('拒绝:父评论属于另一个代币', async () => {
    const parent = await createComment('0xtoken1', 97, '0xuser1', 'on token1', undefined)
    await expect(
      createComment('0xtoken2', 97, '0xuser2', 'reply', parent.id)
    ).rejects.toThrow('父评论与目标代币不匹配')
  })

  it('拒绝:只允许一层嵌套', async () => {
    const parent = await createComment('0xtoken1', 97, '0xuser1', 'top', undefined)
    const reply = await createComment('0xtoken1', 97, '0xuser2', 'reply', parent.id)
    await expect(
      createComment('0xtoken1', 97, '0xuser3', 'nested reply', reply.id)
    ).rejects.toThrow('仅支持一层嵌套回复')
  })

  it('自动 trim 内容', async () => {
    const c = await createComment('0xtoken1', 97, '0xuser1', '  spaced  ', undefined)
    expect(c.content).toBe('spaced')
  })
})

describe('voteComment (差量逻辑)', () => {
  it('首次点赞 +1', async () => {
    const c = await createComment('0xtoken1', 97, '0xuser1', 'x', undefined)
    await voteComment(c.id, '0xuser2', 'up')
    expect(tables.token_comments[0].upvotes).toBe(1)
    expect(tables.token_comments[0].downvotes).toBe(0)
  })

  it('从无投票到 down +1', async () => {
    const c = await createComment('0xtoken1', 97, '0xuser1', 'x', undefined)
    await voteComment(c.id, '0xuser2', 'down')
    expect(tables.token_comments[0].downvotes).toBe(1)
  })

  it('从 up 改 down: -1 up +1 down', async () => {
    const c = await createComment('0xtoken1', 97, '0xuser1', 'x', undefined)
    await voteComment(c.id, '0xuser2', 'up')
    expect(tables.token_comments[0].upvotes).toBe(1)
    await voteComment(c.id, '0xuser2', 'down')
    expect(tables.token_comments[0].upvotes).toBe(0)
    expect(tables.token_comments[0].downvotes).toBe(1)
  })

  it('从 up 撤销为 none: -1 up', async () => {
    const c = await createComment('0xtoken1', 97, '0xuser1', 'x', undefined)
    await voteComment(c.id, '0xuser2', 'up')
    await voteComment(c.id, '0xuser2', 'none')
    expect(tables.token_comments[0].upvotes).toBe(0)
    expect(tables.token_comments[0].downvotes).toBe(0)
  })

  it('撤销不应让计数为负(GREATEST 0 保护)', async () => {
    const c = await createComment('0xtoken1', 97, '0xuser1', 'x', undefined)
    await voteComment(c.id, '0xuser2', 'up') // +1 (从 none 到 up)
    expect(tables.token_comments[0].upvotes).toBe(1)
    await voteComment(c.id, '0xuser2', 'none') // 撤销(从 up 到 none): -1
    expect(tables.token_comments[0].upvotes).toBe(0)
    // 极端情况:已经为 0 时再撤销
    await voteComment(c.id, '0xuser3', 'up') // +1
    tables.token_comments[0].upvotes = 0 // 模拟外部重置
    await voteComment(c.id, '0xuser3', 'none') // 撤销(从 up 到 none): -1
    expect(tables.token_comments[0].upvotes).toBe(0) // GREATEST(0, 0-1) = 0
    expect(tables.token_comments[0].upvotes).toBeGreaterThanOrEqual(0)
  })
})

describe('deleteComment 权限', () => {
  it('作者可以删自己的', async () => {
    const c = await createComment('0xtoken1', 97, '0xuser1', 'x', undefined)
    const ok = await deleteComment(c.id, '0xuser1')
    expect(ok).toBe(true)
    expect(tables.token_comments[0].is_deleted).toBe(true)
  })

  it('别人不能删', async () => {
    const c = await createComment('0xtoken1', 97, '0xuser1', 'x', undefined)
    const ok = await deleteComment(c.id, '0xuser2')
    expect(ok).toBe(false)
    expect(tables.token_comments[0].is_deleted).toBe(false)
  })
})

describe('getCommentCount', () => {
  it('只统计顶层评论', async () => {
    const p1 = await createComment('0xtoken1', 97, '0xuser1', 'top1', undefined)
    await createComment('0xtoken1', 97, '0xuser1', 'top2', undefined)
    await createComment('0xtoken1', 97, '0xuser2', 'reply', p1.id)
    const cnt = await getCommentCount('0xtoken1', 97)
    expect(cnt).toBe(2)
  })
})
