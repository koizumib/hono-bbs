import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { getPosts, patchPost, deletePost } from '../api/posts'
import type { Post } from '../api/types'
import AclEditor, { type AclInput } from '../components/AclEditor'
import ErrorBanner from '../components/ErrorBanner'

function PostRow({ boardId, threadId, post }: { boardId: string; threadId: string; post: Post }) {
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
        <div>
          <p className="text-sm text-gray-400">
            No.{post.postNumber} {post.posterName} {post.isDeleted && <span className="text-red-400">(削除済み)</span>}
          </p>
          <p className="whitespace-pre-wrap text-sm">{post.content}</p>
        </div>
        <div className="flex shrink-0 gap-3 text-sm">
          <button type="button" onClick={() => setEditingAcl((v) => !v)} className="text-primary hover:underline">
            ACL編集
          </button>
          {!post.isDeleted && (
            <button type="button" onClick={handleDelete} className="text-red-400 hover:underline">
              削除
            </button>
          )}
        </div>
      </div>

      <ErrorBanner error={error} />

      {editingAcl && (
        <div className="flex flex-col gap-2">
          <AclEditor label={`No.${post.postNumber} のACL`} value={acl} onChange={setAcl} ownerUserId={post.acl.ownerUserId} />
          <button
            type="button"
            onClick={handleSaveAcl}
            disabled={saving}
            className="self-start rounded bg-primary px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function PostsListPage() {
  const { boardId, threadId } = useParams<{ boardId: string; threadId: string }>()
  const [cursor, setCursor] = useState<string | undefined>(undefined)

  const { data, isLoading } = useQuery({
    queryKey: ['posts', boardId, threadId, cursor],
    queryFn: () => getPosts(boardId!, threadId!, { limit: 50, cursor }),
    enabled: Boolean(boardId) && Boolean(threadId),
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">投稿一覧</h1>
        <Link to={`/boards/${boardId}/threads`} className="text-sm text-primary hover:underline">
          スレッド一覧へ戻る
        </Link>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">読み込み中...</p>
      ) : (
        <div className="flex flex-col">
          {data?.data.map((post) => (
            <PostRow key={post.id} boardId={boardId!} threadId={threadId!} post={post} />
          ))}
        </div>
      )}

      {data?.nextCursor && (
        <button
          type="button"
          onClick={() => setCursor(data.nextCursor ?? undefined)}
          className="self-start rounded border border-border-dark px-3 py-1.5 text-sm hover:bg-surface-dark-2"
        >
          次へ
        </button>
      )}
    </div>
  )
}
