import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { getPosts, patchPost, deletePost } from '../api/posts'
import { getThread } from '../api/threads'
import type { Post } from '../api/types'
import AclEditor, { type AclInput } from '../components/AclEditor'
import ErrorBanner from '../components/ErrorBanner'
import Button from '../components/ui/Button'
import { formatDate } from '../utils/formatDate'

function PostRow({
  boardId,
  threadId,
  post,
  selected,
  onToggleSelected,
}: {
  boardId: string
  threadId: string
  post: Post
  selected: boolean
  onToggleSelected: () => void
}) {
  const queryClient = useQueryClient()
  const [editingAcl, setEditingAcl] = useState(false)
  const [acl, setAcl] = useState<AclInput>({
    grants: post.acl.grants,
    authenticatedActions: post.acl.authenticatedActions,
    anonymousActions: post.acl.anonymousActions,
  })
  const [error, setError] = useState<unknown>(null)
  const [saving, setSaving] = useState(false)

  async function handleSaveAcl() {
    setSaving(true)
    setError(null)
    try {
      await patchPost(boardId, threadId, post.postNumber, { acl })
      await queryClient.invalidateQueries({ queryKey: ['posts', boardId, threadId] })
      setEditingAcl(false)
    } catch (e) {
      setError(e)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm(`No.${post.postNumber} を削除しますか？`)) return
    setError(null)
    try {
      await deletePost(boardId, threadId, post.postNumber)
      await queryClient.invalidateQueries({ queryKey: ['posts', boardId, threadId] })
    } catch (e) {
      setError(e)
    }
  }

  return (
    <div className="flex flex-col gap-2 border-b border-border-dark py-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {!post.isDeleted && (
            <input type="checkbox" checked={selected} onChange={onToggleSelected} className="mt-1" />
          )}
          <div>
            <p className="text-sm text-gray-400">
              No.{post.postNumber} {post.posterName} ・ {formatDate(post.createdAt)}
              {post.isDeleted && <span className="text-red-400"> (削除済み)</span>}
            </p>
            <p className="whitespace-pre-wrap text-sm">{post.content}</p>
          </div>
        </div>
        <div className="flex shrink-0 gap-3 text-sm">
          <Button variant="text" onClick={() => setEditingAcl((v) => !v)}>ACL編集</Button>
          {!post.isDeleted && <Button variant="danger" onClick={handleDelete}>削除</Button>}
        </div>
      </div>

      <ErrorBanner error={error} />

      {editingAcl && (
        <div className="flex flex-col gap-2">
          <AclEditor label={`No.${post.postNumber} のACL`} value={acl} onChange={setAcl} ownerUserId={post.acl.ownerUserId} />
          <Button variant="filled" onClick={handleSaveAcl} disabled={saving} className="self-start">
            {saving ? '保存中...' : '保存'}
          </Button>
        </div>
      )}
    </div>
  )
}

export default function PostsListPage() {
  const { boardId, threadId } = useParams<{ boardId: string; threadId: string }>()
  const queryClient = useQueryClient()
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [filter, setFilter] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const { data: thread } = useQuery({
    queryKey: ['thread', boardId, threadId],
    queryFn: () => getThread(boardId!, threadId!),
    enabled: Boolean(boardId) && Boolean(threadId),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['posts', boardId, threadId, cursor],
    queryFn: () => getPosts(boardId!, threadId!, { limit: 50, cursor }),
    enabled: Boolean(boardId) && Boolean(threadId),
  })

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return data?.data ?? []
    return (data?.data ?? []).filter((p) =>
      p.content.toLowerCase().includes(q) || p.posterName.toLowerCase().includes(q),
    )
  }, [data, filter])

  const selectableCount = useMemo(() => filtered.filter((p) => !p.isDeleted).length, [filtered])

  function toggleSelected(postNumber: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(postNumber)) next.delete(postNumber)
      else next.add(postNumber)
      return next
    })
  }

  function toggleSelectAll() {
    setSelected((prev) =>
      prev.size === selectableCount
        ? new Set()
        : new Set(filtered.filter((p) => !p.isDeleted).map((p) => p.postNumber)),
    )
  }

  async function handleBulkDelete() {
    if (!boardId || !threadId) return
    if (!window.confirm(`選択した${selected.size}件の投稿を削除しますか？`)) return
    setError(null)
    const failures: string[] = []
    for (const postNumber of selected) {
      try {
        await deletePost(boardId, threadId, postNumber)
      } catch (e) {
        failures.push(`No.${postNumber}: ${e instanceof Error ? e.message : '失敗'}`)
      }
    }
    setSelected(new Set())
    await queryClient.invalidateQueries({ queryKey: ['posts', boardId, threadId] })
    if (failures.length > 0) setError(new Error(failures.join('\n')))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">投稿一覧: {thread?.data.title ?? threadId}</h1>
        <Link to={`/boards/${boardId}/threads`} className="text-sm text-primary hover:underline">
          スレッド一覧へ戻る
        </Link>
      </div>

      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="本文・投稿者名で絞り込み（読み込み済みの範囲のみ）"
        className="w-full max-w-sm rounded border border-border-dark bg-surface-dark-2 px-2 py-1.5 text-sm"
      />

      <ErrorBanner error={error} />

      <div className="flex items-center gap-3 text-sm">
        <label className="flex items-center gap-1.5 text-gray-400">
          <input
            type="checkbox"
            checked={selectableCount > 0 && selected.size === selectableCount}
            onChange={toggleSelectAll}
          />
          全選択
        </label>
        {selected.size > 0 && (
          <div className="flex items-center gap-3 rounded border border-border-dark/50 bg-surface-dark-2 px-3 py-1.5">
            <span className="text-gray-300">{selected.size}件選択中</span>
            <Button variant="danger" onClick={handleBulkDelete}>選択した投稿を削除</Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">読み込み中...</p>
      ) : (
        <div className="flex flex-col">
          {filtered.map((post) => (
            <PostRow
              key={post.id}
              boardId={boardId!}
              threadId={threadId!}
              post={post}
              selected={selected.has(post.postNumber)}
              onToggleSelected={() => toggleSelected(post.postNumber)}
            />
          ))}
        </div>
      )}

      {data?.nextCursor && (
        <Button variant="outlined" onClick={() => setCursor(data.nextCursor ?? undefined)} className="self-start">
          次へ
        </Button>
      )}
    </div>
  )
}
