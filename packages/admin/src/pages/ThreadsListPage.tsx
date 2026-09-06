import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { getThreads, patchThread, deleteThread } from '../api/threads'
import { getBoard } from '../api/boards'
import type { Thread } from '../api/types'
import AclEditor, { type AclInput } from '../components/AclEditor'
import ErrorBanner from '../components/ErrorBanner'
import Button from '../components/ui/Button'
import { formatDate } from '../utils/formatDate'

function ThreadRow({
  boardId,
  thread,
  selected,
  onToggleSelected,
}: {
  boardId: string
  thread: Thread
  selected: boolean
  onToggleSelected: () => void
}) {
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
        <div className="flex items-center gap-3">
          <input type="checkbox" checked={selected} onChange={onToggleSelected} />
          <div>
            <p className="text-sm">{thread.title}</p>
            <p className="text-xs text-gray-500">{thread.postCount}件の投稿・{formatDate(thread.createdAt)}</p>
          </div>
        </div>
        <div className="flex shrink-0 gap-3 text-sm">
          <Link to={`/boards/${boardId}/threads/${thread.id}`} className="text-primary hover:underline">
            投稿一覧
          </Link>
          <Button variant="text" onClick={() => setEditingAcl((v) => !v)}>ACL編集</Button>
          <Button variant="danger" onClick={handleDelete}>削除</Button>
        </div>
      </div>

      <ErrorBanner error={error} />

      {editingAcl && (
        <div className="flex flex-col gap-2">
          <AclEditor label={`${thread.title} のACL`} value={acl} onChange={setAcl} ownerUserId={thread.acl.ownerUserId} />
          <Button variant="filled" onClick={handleSaveAcl} disabled={saving} className="self-start">
            {saving ? '保存中...' : '保存'}
          </Button>
        </div>
      )}
    </div>
  )
}

export default function ThreadsListPage() {
  const { boardId } = useParams<{ boardId: string }>()
  const queryClient = useQueryClient()
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [filter, setFilter] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const { data: board } = useQuery({
    queryKey: ['board', boardId],
    queryFn: () => getBoard(boardId!),
    enabled: Boolean(boardId),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['threads', boardId, cursor],
    queryFn: () => getThreads(boardId!, { limit: 20, cursor }),
    enabled: Boolean(boardId),
  })

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return data?.data ?? []
    return (data?.data ?? []).filter((t) => t.title.toLowerCase().includes(q))
  }, [data, filter])

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === filtered.length ? new Set() : new Set(filtered.map((t) => t.id))))
  }

  async function handleBulkDelete() {
    if (!boardId) return
    if (!window.confirm(`選択した${selected.size}件のスレッドを削除しますか？ 投稿も全て削除されます。`)) return
    setError(null)
    const failures: string[] = []
    for (const id of selected) {
      try {
        await deleteThread(boardId, id)
      } catch (e) {
        failures.push(`${id}: ${e instanceof Error ? e.message : '失敗'}`)
      }
    }
    setSelected(new Set())
    await queryClient.invalidateQueries({ queryKey: ['threads', boardId] })
    if (failures.length > 0) setError(new Error(failures.join('\n')))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">スレッド一覧: {board?.data.name ?? boardId}</h1>
        <Link to="/boards" className="text-sm text-primary hover:underline">板一覧へ戻る</Link>
      </div>

      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="タイトルで絞り込み（読み込み済みの範囲のみ）"
        className="w-full max-w-sm rounded border border-border-dark bg-surface-dark-2 px-2 py-1.5 text-sm"
      />

      <ErrorBanner error={error} />

      <div className="flex items-center gap-3 text-sm">
        <label className="flex items-center gap-1.5 text-gray-400">
          <input
            type="checkbox"
            checked={filtered.length > 0 && selected.size === filtered.length}
            onChange={toggleSelectAll}
          />
          全選択
        </label>
        {selected.size > 0 && (
          <div className="flex items-center gap-3 rounded border border-border-dark/50 bg-surface-dark-2 px-3 py-1.5">
            <span className="text-gray-300">{selected.size}件選択中</span>
            <Button variant="danger" onClick={handleBulkDelete}>選択したスレッドを削除</Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">読み込み中...</p>
      ) : (
        <div className="flex flex-col">
          {filtered.map((thread) => (
            <ThreadRow
              key={thread.id}
              boardId={boardId!}
              thread={thread}
              selected={selected.has(thread.id)}
              onToggleSelected={() => toggleSelected(thread.id)}
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
