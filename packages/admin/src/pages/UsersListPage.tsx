import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getUsers, createUser, deleteUser, type CreateUserInput } from '../api/users'
import ErrorBanner from '../components/ErrorBanner'
import Button from '../components/ui/Button'
import BulkImportPanel from '../components/BulkImportPanel'
import { formatDate } from '../utils/formatDate'

const IMPORT_EXAMPLE = JSON.stringify(
  [
    { id: 'user1', password: 'password123', displayName: 'ユーザー1' },
    { id: 'user2', password: 'password123', displayName: 'ユーザー2' },
  ],
  null,
  2,
)

export default function UsersListPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showImport, setShowImport] = useState(false)
  const { data, isLoading } = useQuery({
    queryKey: ['users', page],
    queryFn: () => getUsers(page),
  })

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return data?.data ?? []
    return (data?.data ?? []).filter((u) =>
      u.id.toLowerCase().includes(q) || u.displayName.toLowerCase().includes(q),
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
    setSelected((prev) => (prev.size === filtered.length ? new Set() : new Set(filtered.map((u) => u.id))))
  }

  async function handleBulkDelete() {
    if (!window.confirm(`選択した${selected.size}件のユーザーを削除しますか？`)) return
    setError(null)
    const failures: string[] = []
    for (const id of selected) {
      try {
        await deleteUser(id)
      } catch (e) {
        failures.push(`${id}: ${e instanceof Error ? e.message : '失敗'}`)
      }
    }
    setSelected(new Set())
    await queryClient.invalidateQueries({ queryKey: ['users'] })
    if (failures.length > 0) setError(new Error(failures.join('\n')))
  }

  // limit=0 は無制限 (USER_DISPLAY_LIMIT環境変数)。その場合ページ送りは無意味なので出さない。
  const hasNextPage = (data?.limit ?? 0) > 0 && (data?.data.length ?? 0) === data?.limit

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">ユーザー一覧</h1>
        <Button variant="outlined" onClick={() => setShowImport((v) => !v)}>
          JSONから一括作成
        </Button>
      </div>

      {showImport && (
        <BulkImportPanel<CreateUserInput>
          title="ユーザーの一括作成"
          example={IMPORT_EXAMPLE}
          onImportRow={(row) => createUser(row)}
          onDone={() => queryClient.invalidateQueries({ queryKey: ['users'] })}
        />
      )}

      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="ID・表示名で絞り込み（読み込み済みの範囲のみ）"
        className="w-full max-w-sm rounded border border-border-dark bg-surface-dark-2 px-2 py-1.5 text-sm"
      />

      <ErrorBanner error={error} />

      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded border border-border-dark/50 bg-surface-dark-2 px-3 py-2">
          <span className="text-sm text-gray-300">{selected.size}件選択中</span>
          <Button variant="danger" onClick={handleBulkDelete}>選択したユーザーを削除</Button>
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
              <th className="py-2">表示名</th>
              <th className="py-2">有効</th>
              <th className="py-2">作成日</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => (
              <tr key={user.id} className="border-b border-border-dark">
                <td className="py-2">
                  <input type="checkbox" checked={selected.has(user.id)} onChange={() => toggleSelected(user.id)} />
                </td>
                <td className="py-2">{user.id}</td>
                <td className="py-2">{user.displayName}</td>
                <td className="py-2">{user.isActive ? '有効' : '無効'}</td>
                <td className="py-2 text-gray-400">{formatDate(user.createdAt)}</td>
                <td className="py-2 text-right">
                  <Link to={`/users/${user.id}`} className="text-sm text-primary hover:underline">
                    詳細
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="flex gap-2">
        <Button
          variant="outlined"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          前へ
        </Button>
        <Button
          variant="outlined"
          disabled={!hasNextPage}
          onClick={() => setPage((p) => p + 1)}
        >
          次へ
        </Button>
      </div>
    </div>
  )
}
