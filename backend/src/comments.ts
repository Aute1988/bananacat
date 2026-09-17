/**
 * comments schema - 代币评论系统
 *
 * 表设计:
 *   - 评论支持嵌套回复(一层楼)
 *   - 每条评论可以点赞(upvote/downvote)
 *   - 帖子支持举报
 *   - 内容支持 Markdown(后端不渲染,前端渲染)
 *
 * 索引:
 *   - token_address + chain_id + created_at (列表查询)
 *   - parent_id (找子回复)
 *   - user_address (用户历史)
 */
import { query, queryRaw } from './db.js'

export const CREATE_COMMENTS_TABLE = `
CREATE TABLE IF NOT EXISTS token_comments (
  id            BIGSERIAL PRIMARY KEY,
  token_address TEXT      NOT NULL,
  chain_id      INTEGER   NOT NULL,
  user_address  TEXT      NOT NULL,
  parent_id     BIGINT REFERENCES token_comments(id) ON DELETE CASCADE,
  content       TEXT      NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  upvotes       INTEGER   NOT NULL DEFAULT 0,
  downvotes     INTEGER   NOT NULL DEFAULT 0,
  is_deleted    BOOLEAN   NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 查询索引:按代币查评论列表
CREATE INDEX IF NOT EXISTS idx_comments_token
  ON token_comments(token_address, chain_id, created_at DESC)
  WHERE is_deleted = FALSE;

-- 回复索引:找子评论
CREATE INDEX IF NOT EXISTS idx_comments_parent
  ON token_comments(parent_id)
  WHERE is_deleted = FALSE AND parent_id IS NOT NULL;

-- 用户索引:查某用户的所有评论
CREATE INDEX IF NOT EXISTS idx_comments_user
  ON token_comments(user_address, created_at DESC);

-- upvotes 排序索引
CREATE INDEX IF NOT EXISTS idx_comments_upvotes
  ON token_comments(token_address, upvotes DESC)
  WHERE is_deleted = FALSE;
`

// ============================================================
// Service
// ============================================================

export interface Comment {
  id: number
  token_address: string
  chain_id: number
  user_address: string
  parent_id: number | null
  content: string
  upvotes: number
  downvotes: number
  is_deleted: boolean
  created_at: string
  updated_at: string
  replies?: Comment[]
}

export async function createComment(
  tokenAddress: string,
  chainId: number,
  userAddress: string,
  content: string,
  parentId?: number
): Promise<Comment> {
  // 🆕 如果有 parentId,校验它是否存在且属于同一个 token
  if (parentId) {
    const parent = await query<{ token_address: string; chain_id: number; parent_id: number | null }>(
      `SELECT token_address, chain_id, parent_id FROM token_comments WHERE id = $1 AND is_deleted = FALSE`,
      [parentId]
    )
    if (parent.length === 0) {
      throw new Error('父评论不存在')
    }
    if (parent[0].token_address !== tokenAddress.toLowerCase() || parent[0].chain_id !== chainId) {
      throw new Error('父评论与目标代币不匹配')
    }
    // 🆕 防止无限嵌套:只允许一层回复(parent_id 为 NULL 即主评论)
    if (parent[0].parent_id !== null) {
      throw new Error('仅支持一层嵌套回复')
    }
  }

  const rows = await query<Comment>(
    `INSERT INTO token_comments (token_address, chain_id, user_address, content, parent_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [tokenAddress.toLowerCase(), chainId, userAddress.toLowerCase(), content.trim(), parentId ?? null]
  )
  return rows[0]
}

export async function getCommentsByToken(
  tokenAddress: string,
  chainId: number,
  sortBy: 'latest' | 'top' = 'top',
  limit = 50,
  offset = 0
) {
  const orderCol = sortBy === 'top' ? 'upvotes DESC, created_at DESC' : 'created_at DESC'

  // 主评论(parent_id IS NULL)
  const parents = await query<Comment>(
    `SELECT * FROM token_comments
     WHERE token_address = $1 AND chain_id = $2
       AND parent_id IS NULL AND is_deleted = FALSE
     ORDER BY ${orderCol}
     LIMIT $3 OFFSET $4`,
    [tokenAddress.toLowerCase(), chainId, limit, offset]
  )

  // 一次性查出所有子评论(避免 N+1)
  if (parents.length === 0) return []

  const parentIds = parents.map(p => p.id)
  const replies = await query<Comment>(
    `SELECT * FROM token_comments
     WHERE parent_id = ANY($1) AND is_deleted = FALSE
     ORDER BY created_at ASC`,
    [parentIds]
  )

  // 按 parent_id 分组
  const replyMap = new Map<number, Comment[]>()
  for (const r of replies) {
    if (!replyMap.has(r.parent_id!)) replyMap.set(r.parent_id!, [])
    replyMap.get(r.parent_id!)!.push(r)
  }

  return parents.map(p => ({ ...p, replies: replyMap.get(p.id) || [] }))
}

export async function getCommentCount(
  tokenAddress: string,
  chainId: number
): Promise<number> {
  const rows = await query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM token_comments
     WHERE token_address = $1 AND chain_id = $2
       AND is_deleted = FALSE`,
    [tokenAddress.toLowerCase(), chainId]
  )
  return rows[0]?.count ?? 0
}

export async function voteComment(
  commentId: number,
  userAddress: string,
  vote: 'up' | 'down' | 'none'
) {
  // 先查旧投票(决定是 + 还是 -)
  const prev = await query<{ vote_type: string }>(
    `SELECT vote_type FROM comment_votes
     WHERE comment_id = $1 AND user_address = $2`,
    [commentId, userAddress.toLowerCase()]
  )
  const prevVote = prev[0]?.vote_type ?? 'none'

  // 记录新投票(防重复)
  await query(
    `INSERT INTO comment_votes (comment_id, user_address, vote_type)
     VALUES ($1, $2, $3)
     ON CONFLICT (comment_id, user_address)
     DO UPDATE SET vote_type = $3, voted_at = NOW()`,
    [commentId, userAddress.toLowerCase(), vote]
  )

  // 🆕 计算差量:撤销旧 + 加新
  // 例:旧=up,新=none → upvotes -1
  // 例:旧=none,新=up → upvotes +1
  // 例:旧=up,新=down → upvotes -1, downvotes +1
  let upDelta = 0
  let downDelta = 0
  if (prevVote === 'up') upDelta--
  if (prevVote === 'down') downDelta--
  if (vote === 'up') upDelta++
  if (vote === 'down') downDelta++

  if (upDelta !== 0 || downDelta !== 0) {
    await query(
      `UPDATE token_comments
       SET upvotes = GREATEST(0, upvotes + $2),
           downvotes = GREATEST(0, downvotes + $3),
           updated_at = NOW()
       WHERE id = $1`,
      [commentId, upDelta, downDelta]
    )
  }
}

export async function deleteComment(commentId: number, userAddress: string): Promise<boolean> {
  const result = await queryRaw(
    `UPDATE token_comments SET is_deleted = TRUE, content = '[已删除]', updated_at = NOW()
     WHERE id = $1 AND user_address = $2`,
    [commentId, userAddress.toLowerCase()]
  )
  return result.rowCount > 0
}

export async function reportComment(
  commentId: number,
  reporterAddress: string,
  reason: string
) {
  await query(
    `INSERT INTO comment_reports (comment_id, reporter_address, reason)
     VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING`,
    [commentId, reporterAddress.toLowerCase(), reason.trim()]
  )
}

// ============================================================
// 评论投票表 + 举报表(建表语句)
// ============================================================

export const CREATE_VOTES_TABLE = `
CREATE TABLE IF NOT EXISTS comment_votes (
  id           BIGSERIAL PRIMARY KEY,
  comment_id   BIGINT   NOT NULL REFERENCES token_comments(id) ON DELETE CASCADE,
  user_address TEXT     NOT NULL,
  vote_type    TEXT     NOT NULL CHECK (vote_type IN ('up', 'down', 'none')),
  voted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(comment_id, user_address)
);

CREATE INDEX IF NOT EXISTS idx_votes_comment ON comment_votes(comment_id);
`

export const CREATE_REPORTS_TABLE = `
CREATE TABLE IF NOT EXISTS comment_reports (
  id               BIGSERIAL PRIMARY KEY,
  comment_id       BIGINT   NOT NULL REFERENCES token_comments(id) ON DELETE CASCADE,
  reporter_address TEXT     NOT NULL,
  reason           TEXT     NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 500),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports ON comment_reports(comment_id);
`
