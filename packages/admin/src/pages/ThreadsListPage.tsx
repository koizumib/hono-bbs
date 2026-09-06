import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { getThreads, deleteThread } from '../api/threads'
import ErrorBanner from '../components/ErrorBanner'

export default function ThreadsListPage() {
  const { boardId } = useParams<{ boardId: string }>()
  const queryClient = useQueryClient()
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [error, setError] = useState<unknown>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['threads', boardId, cursor],
    queryFn: () => getThreads(boardId!, { limit: 20, cursor }),
    enabled: Boolean(boardId),
  })

  async function handleDelete(threadId: string) {
    if (!boardId) return
    if (!window.confirm('このスレッドを削除しますか？ 投稿も全て削除されます。')) return
    setError(null)
    try {
      await deleteThread(boardId, threadId)
      await queryClient.invalidateQueries({ queryKey: ['threads', boardId] })
    } catch (e) {
      setError(e)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">スレッド一覧: {boardId}</h1>
        <Link to="/boards" className="text-sm text-primary hover:underline">板一覧へ戻る</Link>
      </div>

      <ErrorBanner error={error} />

      {isLoading ? (
        <p className="text-sm text-gray-400">読み込み中...</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-dark text-left text-gray-400">
              <th className="py-2">タイトル</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {data?.data.map((thread) => (
              <tr key={thread.id} className="border-b border-border-dark">
                <td className="py-2">{thread.title}</td>
                <td className="py-2 text-right">
                  <Link to={`/boards/${boardId}/threads/${thread.id}`} className="mr-3 text-primary hover:underline">
                    投稿一覧
                  </Link>
                  <button type="button" onClick={() => handleDelete(thread.id)} className="text-red-400 hover:underline">
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
