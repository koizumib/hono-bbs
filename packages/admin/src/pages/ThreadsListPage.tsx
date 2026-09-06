import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { getThreads, patchThread, deleteThread } from '../api/threads'
import type { Thread } from '../api/types'
import AclEditor, { type AclInput } from '../components/AclEditor'
import ErrorBanner from '../components/ErrorBanner'

function ThreadRow({ boardId, thread }: { boardId: string; thread: Thread }) {
  const queryClient = useQueryClient()
  const [editingAcl, setEditingAcl] = useState(false)
  const [acl, setAcl] = useState<AclInput>({
    grants: thread.acl.grants,
    authenticatedActions: thread.acl.authenticatedActions,
    anonymousActions: thread.acl.anonymousActions,
  })
  const [error, setError] = useState<unknown>(null)
  const [saving, setSaving] = useState(false)

  async function handleSaveAcl() {
    setSaving(true)
    setError(null)
    try {
      await patchThread(boardId, thread.id, { acl })
      await queryClient.invalidateQueries({ queryKey: ['threads', boardId] })
      setEditingAcl(false)
    } catch (e) {
      setError(e)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm('このスレッドを削除しますか？ 投稿も全て削除されます。')) return
    setError(null)
    try {
      await deleteThread(boardId, thread.id)
      await queryClient.invalidateQueries({ queryKey: ['threads', boardId] })
    } catch (e) {
      setError(e)
    }
  }

  return (
    <div className="flex flex-col gap-2 border-b border-border-dark py-3">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm">{thread.title}</p>
        <div className="flex shrink-0 gap-3 text-sm">
          <Link to={`/boards/${boardId}/threads/${thread.id}`} className="text-primary hover:underline">
            投稿一覧
          </Link>
          <button type="button" onClick={() => setEditingAcl((v) => !v)} className="text-primary hover:underline">
            ACL編集
          </button>
          <button type="button" onClick={handleDelete} className="text-red-400 hover:underline">
            削除
          </button>
        </div>
      </div>

      <ErrorBanner error={error} />

      {editingAcl && (
        <div className="flex flex-col gap-2">
          <AclEditor label={`${thread.title} のACL`} value={acl} onChange={setAcl} ownerUserId={thread.acl.ownerUserId} />
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

export default function ThreadsListPage() {
  const { boardId } = useParams<{ boardId: string }>()
  const [cursor, setCursor] = useState<string | undefined>(undefined)

  const { data, isLoading } = useQuery({
    queryKey: ['threads', boardId, cursor],
    queryFn: () => getThreads(boardId!, { limit: 20, cursor }),
    enabled: Boolean(boardId),
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">スレッド一覧: {boardId}</h1>
        <Link to="/boards" className="text-sm text-primary hover:underline">板一覧へ戻る</Link>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">読み込み中...</p>
      ) : (
        <div className="flex flex-col">
          {data?.data.map((thread) => (
            <ThreadRow key={thread.id} boardId={boardId!} thread={thread} />
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
