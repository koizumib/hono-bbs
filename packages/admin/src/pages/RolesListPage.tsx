import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getRoles } from '../api/roles'
import { formatDate } from '../utils/formatDate'
import Button from '../components/ui/Button'

export default function RolesListPage() {
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState('')
  const { data, isLoading } = useQuery({
    queryKey: ['roles', page],
    queryFn: () => getRoles(page),
  })

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return data?.data ?? []
    return (data?.data ?? []).filter((r) =>
      r.id.toLowerCase().includes(q) || r.name.toLowerCase().includes(q),
    )
  }, [data, filter])

  const hasNextPage = (data?.limit ?? 0) > 0 && (data?.data.length ?? 0) === data?.limit

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">ロール一覧</h1>
        <Link to="/roles/new">
          <Button variant="filled">+ ロールを作成</Button>
        </Link>
      </div>

      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="ID・名前で絞り込み（読み込み済みの範囲のみ）"
        className="w-full max-w-sm rounded border border-border-dark bg-surface-dark-2 px-2 py-1.5 text-sm"
      />

      {isLoading ? (
        <p className="text-sm text-gray-400">読み込み中...</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-dark text-left text-gray-400">
              <th className="py-2">ID</th>
              <th className="py-2">名前</th>
              <th className="py-2">作成日</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((role) => (
              <tr key={role.id} className="border-b border-border-dark">
                <td className="py-2">{role.id}</td>
                <td className="py-2">{role.name}</td>
                <td className="py-2 text-gray-400">{formatDate(role.createdAt)}</td>
                <td className="py-2 text-right">
                  <Link to={`/roles/${role.id}`} className="text-primary hover:underline">
                    詳細
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="flex gap-2">
        <Button variant="outlined" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
          前へ
        </Button>
        <Button variant="outlined" disabled={!hasNextPage} onClick={() => setPage((p) => p + 1)}>
          次へ
        </Button>
      </div>
    </div>
  )
}
