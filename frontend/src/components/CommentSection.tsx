/**
 * CommentSection - 代币评论区
 * 功能:发评论 / 回复 / 点赞点踩 / 删除 / 举报
 * 支持按"最热"或"最新"排序
 *
 * 🆕 SIWE:所有写操作(发/投票/删/举报)都用 signedFetch 走签名验证
 */
import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useWallet, useSIWE } from '../hooks/useWallet'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface Comment {
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

interface Props {
  tokenAddress: string
  chainId: number
}

export default function CommentSection({ tokenAddress, chainId }: Props) {
  const { t } = useTranslation()
  const { address: walletAddr } = useWallet()
  const { signedFetch } = useSIWE()
  const queryClient = useQueryClient()
  const [sort, setSort] = useState<'top' | 'latest'>('top')
  const [page, setPage] = useState(0)
  const LIMIT = 20

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['comments', tokenAddress, chainId, sort, page],
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE}/api/comments/${chainId}/${tokenAddress}?sort=${sort}&limit=${LIMIT}&offset=${page * LIMIT}`
      )
      if (!res.ok) throw new Error('加载失败')
      const json = await res.json()
      // 🆕 强制 number 类型,避免字符串 '5' 跟数字比大小
      return { ...json, total: Number(json.total || 0) } as Promise<{
        comments: Comment[]
        total: number
      }>
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  })

  const postMutation = useMutation({
    mutationFn: async (body: { content: string; parentId?: number }) => {
      // 🆕 SIWE:用签名验证身份,后端从 header 恢复地址
      const res = await signedFetch('/api/comments', {
        method: 'POST',
        body: JSON.stringify({
          tokenAddress,
          chainId,
          content: body.content,
          parentId: body.parentId,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '请求失败' }))
        throw new Error(err.error || '发送失败')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', tokenAddress, chainId] })
    },
  })

  const voteMutation = useMutation({
    mutationFn: async (vars: { commentId: number; vote: 'up' | 'down' | 'none' }) => {
      // 🆕 SIWE
      const res = await signedFetch(`/api/comments/${vars.commentId}/vote`, {
        method: 'POST',
        body: JSON.stringify({ vote: vars.vote }),
      })
      if (!res.ok) throw new Error('投票失败')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', tokenAddress, chainId] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (commentId: number) => {
      if (!walletAddr) throw new Error('钱包未连接')
      // 🆕 SIWE
      const res = await signedFetch(`/api/comments/${commentId}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '删除失败' }))
        throw new Error(err.error || '删除失败')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', tokenAddress, chainId] })
    },
  })

  const reportMutation = useMutation({
    mutationFn: async (vars: { commentId: number; reason: string }) => {
      if (!walletAddr) throw new Error('钱包未连接')
      // 🆕 SIWE
      const res = await signedFetch(`/api/comments/${vars.commentId}/report`, {
      })
      if (!res.ok) throw new Error('举报失败')
      return res.json()
    },
  })

  return (
    <div className="space-y-4">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-white flex items-center gap-2">
          💬 {t('comments.title')}
          {data && (
            <span className="text-xs text-gray-500 font-normal">
              ({data.total})
            </span>
          )}
        </h3>
        <div className="flex gap-1 text-xs">
          <button
            onClick={() => setSort('top')}
            className={`px-3 py-1 rounded-lg ${sort === 'top' ? 'bg-yellow-500/20 text-yellow-400' : 'text-gray-500'}`}
          >
            🔥 {t('comments.top')}
          </button>
          <button
            onClick={() => setSort('latest')}
            className={`px-3 py-1 rounded-lg ${sort === 'latest' ? 'bg-yellow-500/20 text-yellow-400' : 'text-gray-500'}`}
          >
            🕐 {t('comments.latest')}
          </button>
        </div>
      </div>

      {/* 发评论 */}
      <CommentInput
        onSubmit={(content) => postMutation.mutate({ content })}
        isLoading={postMutation.isPending}
        placeholder={t('comments.placeholder')}
      />

      {/* 列表 */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="banana-card p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-full bg-dark-300" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-dark-300 rounded w-1/4" />
                  <div className="h-3 bg-dark-300 rounded w-full" />
                  <div className="h-3 bg-dark-300 rounded w-2/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isError && (
        <div className="text-center py-6 text-gray-500 space-y-2">
          <div className="text-3xl">😵</div>
          <p>{(error as Error)?.message || t('common.error')}</p>
          <button onClick={() => refetch()} className="text-xs text-yellow-400 hover:text-yellow-300">
            🔄 {t('common.retry')}
          </button>
        </div>
      )}

      {data && data.comments.length === 0 && (
        <div className="text-center py-8 text-gray-500 space-y-2">
          <div className="text-4xl">💬</div>
          <p>{t('token.noComments')}</p>
        </div>
      )}

      {data && data.comments.map(comment => (
        <div key={comment.id} className="space-y-3">
          <CommentCard
            comment={comment}
            walletAddr={walletAddr}
            onVote={(vote) => voteMutation.mutate({ commentId: comment.id, vote })}
            onDelete={(id) => deleteMutation.mutate(id)}
            onReply={(content) => postMutation.mutate({ content, parentId: comment.id })}
          />

          {/* 子回复 */}
          {comment.replies && comment.replies.length > 0 && (
            <div className="ml-6 pl-4 border-l-2 border-yellow-500/20 space-y-2">
              {comment.replies.map(reply => (
                <CommentCard
                  key={reply.id}
                  comment={reply}
                  walletAddr={walletAddr}
                  isReply
                  onVote={(vote) => voteMutation.mutate({ commentId: reply.id, vote })}
                  onDelete={(id) => deleteMutation.mutate(id)}
                />
              ))}
            </div>
          )}
        </div>
      ))}

      {/* 分页 */}
      {data && data.total > LIMIT && (
        <div className="text-center">
          <button
            onClick={() => setPage(p => p + 1)}
            className="text-sm text-yellow-400 hover:text-yellow-300"
          >
            {t('comments.loadMore')} ({data.comments.length}/{data.total})
          </button>
        </div>
      )}
    </div>
  )
}

// ============================================================
// 子组件
// ============================================================

function CommentInput({
  onSubmit,
  isLoading,
  placeholder,
  initialValue = '',
  onCancel,
  onSubmitLabel,
}: {
  onSubmit: (content: string) => void
  isLoading?: boolean
  placeholder?: string
  initialValue?: string
  onCancel?: () => void
  onSubmitLabel?: string
}) {
  const { t } = useTranslation()
  const { address } = useWallet()
  const [content, setContent] = useState(initialValue)

  const handleSubmit = useCallback(() => {
    if (!content.trim()) return
    onSubmit(content.trim())
    setContent('')
  }, [content, onSubmit])

  if (!address) {
    return (
      <div className="banana-card p-4 text-center text-gray-500 text-sm">
        🔒 {t('comments.loginRequired')}
      </div>
    )
  }

  return (
    <div className="banana-card p-3">
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit()
        }}
        placeholder={placeholder || t('comments.placeholder')}
        maxLength={1000}
        rows={3}
        className="w-full bg-dark-300 border border-white/10 rounded-xl p-3 text-sm text-white
                   placeholder-gray-600 resize-none outline-none focus:border-yellow-500/40 transition-colors"
      />
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-gray-600">{content.length}/1000 · ⌘+Enter 发送</span>
        <div className="flex gap-2">
          {onCancel && (
            <button onClick={onCancel} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white">
              {t('comments.cancel')}
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={isLoading || !content.trim()}
            className="btn-banana py-1.5 px-4 text-sm disabled:opacity-40"
          >
            {isLoading ? '...' : onSubmitLabel || t('comments.send')}
          </button>
        </div>
      </div>
    </div>
  )
}

function CommentCard({
  comment,
  walletAddr,
  isReply,
  onVote,
  onDelete,
  onReply,
}: {
  comment: Comment
  walletAddr: string | null
  isReply?: boolean
  onVote: (vote: 'up' | 'down' | 'none') => void
  onDelete: (id: number) => void
  onReply?: (content: string) => void
}) {
  const { t } = useTranslation()
  const { signedFetch } = useSIWE()
  const queryClient = useQueryClient()
  const [showReply, setShowReply] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [reportText, setReportText] = useState('')
  const [myVote, setMyVote] = useState<'up' | 'down' | 'none'>('none')

  const reportMutation = useMutation({
    mutationFn: async (vars: { commentId: number; reason: string }) => {
      if (!walletAddr) throw new Error('钱包未连接')
      const res = await signedFetch(`/api/comments/${vars.commentId}/report`, {
        method: 'POST',
        body: JSON.stringify({ reason: vars.reason }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '提交失败' }))
        throw new Error(err.error || '提交失败')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments'] })
      setShowReport(false)
      setReportText('')
    },
  })

  const shortAddr = comment.user_address
    ? `${comment.user_address.slice(0, 4)}...${comment.user_address.slice(-3)}`
    : '?'

  const isOwner = walletAddr && walletAddr.toLowerCase() === comment.user_address?.toLowerCase()

  const handleVote = (v: 'up' | 'down') => {
    const next = myVote === v ? 'none' : v
    setMyVote(next)
    onVote(next)
  }

  return (
    <div className={`banana-card p-3 ${isReply ? '' : ''}`}>
      {/* 头部:头像 + 地址 + 时间 */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500
                        flex items-center justify-center text-xs font-bold text-black shrink-0">
          {shortAddr.slice(0, 2).toUpperCase()}
        </div>
        <span className="font-mono text-xs text-gray-400">{shortAddr}</span>
        <span className="text-xs text-gray-600 ml-auto">
          {formatTime(comment.created_at)}
        </span>
      </div>

      {/* 内容 */}
      <p className={`text-sm leading-relaxed ${comment.is_deleted ? 'text-gray-600 italic' : 'text-gray-200'}`}>
        {comment.content}
      </p>

      {/* 操作栏 */}
      {!comment.is_deleted && (
        <div className="flex items-center gap-3 mt-3 text-xs">
          {/* 点赞 */}
          <button
            onClick={() => handleVote('up')}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-colors ${
              myVote === 'up' ? 'text-green-400 bg-green-500/10' : 'text-gray-500 hover:text-green-400'
            }`}
          >
            ▲ {comment.upvotes || 0}
          </button>

          {/* 点踩 */}
          <button
            onClick={() => handleVote('down')}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-colors ${
              myVote === 'down' ? 'text-red-400 bg-red-500/10' : 'text-gray-500 hover:text-red-400'
            }`}
          >
            ▼ {comment.downvotes || 0}
          </button>

          {/* 回复 */}
          {!isReply && onReply && walletAddr && (
            <button
              onClick={() => setShowReply(!showReply)}
              className="text-gray-500 hover:text-yellow-400 transition-colors"
            >
              💬 {t('comments.reply')}
            </button>
          )}

          {/* 举报 */}
          {walletAddr && !isOwner && (
            <button
              onClick={() => setShowReport(!showReport)}
              className="text-gray-600 hover:text-red-400 ml-auto transition-colors"
            >
              🚩 {t('comments.report')}
            </button>
          )}

          {/* 删除 */}
          {isOwner && (
            <button
              onClick={() => onDelete(comment.id)}
              className="text-gray-600 hover:text-red-400 ml-auto transition-colors"
            >
              🗑️ {t('comments.delete')}
            </button>
          )}
        </div>
      )}

      {/* 回复框 */}
      {showReply && onReply && (
        <div className="mt-3">
          <CommentInput
            onSubmit={(content) => { onReply(content); setShowReply(false) }}
            placeholder={`${t('comments.replyTo')} ${shortAddr}...`}
            onCancel={() => setShowReply(false)}
            onSubmitLabel={t('comments.send')}
          />
        </div>
      )}

      {/* 举报框 */}
      {showReport && (
        <div className="mt-3 p-3 bg-dark-300 rounded-xl space-y-2">
          <p className="text-xs text-gray-400">{t('comments.reportReason')}:</p>
          <textarea
            value={reportText}
            onChange={e => setReportText(e.target.value)}
            placeholder={t('comments.reportReason')}
            maxLength={500}
            rows={2}
            className="w-full bg-dark-200 border border-white/10 rounded-lg p-2 text-sm text-white
                       placeholder-gray-600 resize-none outline-none focus:border-red-500/40"
          />
          {reportMutation.isError && (
            <p className="text-xs text-red-400">{(reportMutation.error as Error).message}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (!reportText.trim()) return
                reportMutation.mutate(
                  { commentId: comment.id, reason: reportText.trim() },
                  {
                    onSuccess: () => {
                      setShowReport(false)
                      setReportText('')
                    },
                  }
                )
              }}
              disabled={reportMutation.isPending}
              className="btn-banana py-1 px-3 text-xs"
            >
              {reportMutation.isPending ? '...' : t('comments.report')}
            </button>
            <button onClick={() => setShowReport(false)} className="px-3 py-1 text-xs text-gray-400">
              {t('comments.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = Date.now()
  const diff = now - d.getTime()
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}
