import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getBoards, deleteBoard } from '../api/boards'
import ErrorBanner from '../components/ErrorBanner'

export default function BoardsListPage() {
  const queryClient = useQueryClient()
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [error, setError] = useState<unknown>(null)
  const { data, isLoading } = useQuery({
    queryKey: ['boards', cursor],
    queryFn: () => getBoards({ limit: 20, cursor }),
  })

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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">板一覧</h1>
        <Link to="/boards/new" className="rounded bg-primary px-3 py-1.5 text-sm text-white">
          + 板を作成
        </Link>
      </div>

      <ErrorBanner error={error} />

      {isLoading ? (
        <p className="text-sm text-gray-400">読み込み中...</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-dark text-left text-gray-400">
              <th className="py-2">ID</th>
              <th className="py-2">名前</th>
              <th className="py-2">カテゴリ</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {data?.data.map((board) => (
              <tr key={board.id} className="border-b border-border-dark">
                <td className="py-2">{board.id}</td>
                <td className="py-2">{board.name}</td>
                <td className="py-2">{board.category ?? '-'}</td>
                <td className="py-2 text-right">
                  <Link to={`/boards/${board.id}/threads`} className="mr-3 text-primary hover:underline">
                    スレッド
                  </Link>
                  <Link to={`/boards/${board.id}/edit`} className="mr-3 text-primary hover:underline">
                    編集
                  </Link>
                  <button type="button" onClick={() => handleDelete(board.id)} className="text-red-400 hover:underline">
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
