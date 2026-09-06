import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getUsers } from '../api/users'

export default function UsersListPage() {
  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['users', page],
    queryFn: () => getUsers(page),
  })

  // limit=0 は無制限 (USER_DISPLAY_LIMIT環境変数)。その場合ページ送りは無意味なので出さない。
  const hasNextPage = (data?.limit ?? 0) > 0 && (data?.data.length ?? 0) === data?.limit

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-medium">ユーザー一覧</h1>

      {isLoading ? (
        <p className="text-sm text-gray-400">読み込み中...</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-dark text-left text-gray-400">
              <th className="py-2">ID</th>
              <th className="py-2">表示名</th>
              <th className="py-2">有効</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {data?.data.map((user) => (
              <tr key={user.id} className="border-b border-border-dark">
                <td className="py-2">{user.id}</td>
                <td className="py-2">{user.displayName}</td>
                <td className="py-2">{user.isActive ? '有効' : '無効'}</td>
                <td className="py-2 text-right">
                  <Link to={`/users/${user.id}`} className="text-primary hover:underline">
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
