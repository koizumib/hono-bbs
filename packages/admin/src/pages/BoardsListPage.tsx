import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getBoards, createBoard, deleteBoard, type CreateBoardInput } from '../api/boards'
import ErrorBanner from '../components/ErrorBanner'
import Button from '../components/ui/Button'
import BulkImportPanel from '../components/BulkImportPanel'
import { formatDate } from '../utils/formatDate'

const IMPORT_EXAMPLE = JSON.stringify(
  [
    {
      id: 'board1', name: '雑談板', description: '', category: '',
      maxThreads: 1000, maxThreadTitleLength: 200,
      defaultMaxPosts: 1000, defaultMaxPostLength: 2000, defaultMaxPostLines: 100,
      defaultMaxPosterNameLength: 50, defaultMaxPosterOptionLength: 100,
      defaultPosterName: '名無しさん', defaultIdFormat: 'daily_hash',
      acl: { grants: [], authenticatedActions: ['read', 'create', 'update', 'delete'], anonymousActions: ['read', 'create'] },
      defaultThreadAcl: { grants: [], authenticatedActions: ['read', 'create', 'update', 'delete'], anonymousActions: ['read', 'create'] },
      defaultPostAcl: { grants: [], authenticatedActions: ['read', 'create', 'update', 'delete'], anonymousActions: ['read', 'create'] },
    },
  ],
  null,
  2,
)

export default function BoardsListPage() {
  const queryClient = useQueryClient()
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [filter, setFilter] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showImport, setShowImport] = useState(false)
  const { data, isLoading } = useQuery({
    queryKey: ['boards', cursor],
    queryFn: () => getBoards({ limit: 20, cursor }),
  })

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return data?.data ?? []
    return (data?.data ?? []).filter((b) =>
      b.id.toLowerCase().includes(q) || b.name.toLowerCase().includes(q),
    )
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
    setSelected((prev) => (prev.size === filtered.length ? new Set() : new Set(filtered.map((b) => b.id))))
  }

  async function handleDelete(boardId: string) {
    if (!window.confirm(`板 "${boardId}" を削除しますか？ スレッド・投稿も全て削除されます。`)) return
    setError(null)
    try {
      await deleteBoard(boardId)
      await queryClient.invalidateQueries({ queryKey: ['boards'] })
    } catch (e) {
      setError(e)
    }
  }

  async function handleBulkDelete() {
    if (!window.confirm(`選択した${selected.size}件の板を削除しますか？ スレッド・投稿も全て削除されます。`)) return
    setError(null)
    const failures: string[] = []
    for (const id of selected) {
      try {
        await deleteBoard(id)
      } catch (e) {
        failures.push(`${id}: ${e instanceof Error ? e.message : '失敗'}`)
      }
    }
    setSelected(new Set())
    await queryClient.invalidateQueries({ queryKey: ['boards'] })
    if (failures.length > 0) setError(new Error(failures.join('\n')))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">板一覧</h1>
        <div className="flex gap-2">
          <Button variant="outlined" onClick={() => setShowImport((v) => !v)}>
            JSONから一括作成
          </Button>
          <Link to="/boards/new">
            <Button variant="filled">+ 板を作成</Button>
          </Link>
        </div>
      </div>

      {showImport && (
        <BulkImportPanel<CreateBoardInput>
          title="板の一括作成"
          example={IMPORT_EXAMPLE}
          onImportRow={(row) => createBoard(row)}
          onDone={() => queryClient.invalidateQueries({ queryKey: ['boards'] })}
        />
      )}

      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="ID・名前で絞り込み（読み込み済みの範囲のみ）"
        className="w-full max-w-sm rounded border border-border-dark bg-surface-dark-2 px-2 py-1.5 text-sm"
      />

      <ErrorBanner error={error} />

      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded border border-border-dark/50 bg-surface-dark-2 px-3 py-2">
          <span className="text-sm text-gray-300">{selected.size}件選択中</span>
          <Button variant="danger" onClick={handleBulkDelete}>選択した板を削除</Button>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-400">読み込み中...</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-dark text-left text-gray-400">
              <th className="w-8 py-2">
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && selected.size === filtered.length}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="py-2">ID</th>
              <th className="py-2">名前</th>
              <th className="py-2">カテゴリ</th>
              <th className="py-2">作成日</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((board) => (
              <tr key={board.id} className="border-b border-border-dark">
                <td className="py-2">
                  <input type="checkbox" checked={selected.has(board.id)} onChange={() => toggleSelected(board.id)} />
                </td>
                <td className="py-2">{board.id}</td>
                <td className="py-2">{board.name}</td>
                <td className="py-2">{board.category ?? '-'}</td>
                <td className="py-2 text-gray-400">{formatDate(board.createdAt)}</td>
                <td className="py-2 text-right">
                  <Link to={`/boards/${board.id}/threads`} className="mr-3 text-sm text-primary hover:underline">
                    スレッド
                  </Link>
                  <Link to={`/boards/${board.id}/edit`} className="mr-3 text-sm text-primary hover:underline">
                    編集
                  </Link>
                  <Button variant="danger" onClick={() => handleDelete(board.id)}>削除</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {data?.nextCursor && (
        <Button variant="outlined" onClick={() => setCursor(data.nextCursor ?? undefined)} className="self-start">
          次へ
        </Button>
      )}
    </div>
  )
}
