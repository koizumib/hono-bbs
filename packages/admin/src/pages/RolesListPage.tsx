import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getRoles } from '../api/roles'

export default function RolesListPage() {
  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['roles', page],
    queryFn: () => getRoles(page),
  })

  const hasNextPage = (data?.limit ?? 0) > 0 && (data?.data.length ?? 0) === data?.limit

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">ロール一覧</h1>
        <Link to="/roles/new" className="rounded bg-primary px-3 py-1.5 text-sm text-white">
          + ロールを作成
        </Link>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">読み込み中...</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-dark text-left text-gray-400">
              <th className="py-2">ID</th>
              <th className="py-2">名前</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {data?.data.map((role) => (
              <tr key={role.id} className="border-b border-border-dark">
                <td className="py-2">{role.id}</td>
                <td className="py-2">{role.name}</td>
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
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="rounded border border-border-dark px-3 py-1.5 text-sm hover:bg-surface-dark-2 disabled:opacity-50"
        >
          前へ
        </button>
        <button
          type="button"
          disabled={!hasNextPage}
          onClick={() => setPage((p) => p + 1)}
          className="rounded border border-border-dark px-3 py-1.5 text-sm hover:bg-surface-dark-2 disabled:opacity-50"
        >
          次へ
        </button>
      </div>
    </div>
  )
}
