import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getReports, resolveReport, dismissReport } from '../api/moderation'
import { formatDate } from '../utils/formatDate'
import ErrorBanner from '../components/ErrorBanner'
import Button from '../components/ui/Button'

type StatusFilter = 'open' | 'resolved' | 'dismissed'

const STATUS_LABELS: Record<StatusFilter, string> = {
  open: '未対応',
  resolved: '対応済み',
  dismissed: '却下',
}

export default function ReportsListPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<StatusFilter>('open')
  const [error, setError] = useState<unknown>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['reports', status, page],
    queryFn: () => getReports(page, status),
  })

  const hasNextPage = (data?.limit ?? 0) > 0 && (data?.data.length ?? 0) === data?.limit

  async function handleSetStatus(id: string, action: 'resolve' | 'dismiss') {
    setProcessingId(id)
    setError(null)
    try {
      if (action === 'resolve') await resolveReport(id)
      else await dismissReport(id)
      await queryClient.invalidateQueries({ queryKey: ['reports'] })
    } catch (e) {
      setError(e)
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-medium">通報キュー</h1>

      <ErrorBanner error={error} />

      <div className="flex gap-1">
        {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => { setStatus(s); setPage(1) }}
            className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
              status === s ? 'bg-primary text-white' : 'border border-border-dark text-gray-300 hover:bg-surface-dark-2'
            }`}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">読み込み中...</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-dark text-left text-gray-400">
              <th className="py-2">種別</th>
              <th className="py-2">内容（通報時点）</th>
              <th className="py-2">通報日時</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {data?.data.map((report) => (
              <tr key={report.id} className="border-b border-border-dark align-top">
                <td className="py-2">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-dark-2 text-gray-400">
                    {report.targetType === 'thread' ? 'スレ' : 'レス'}
                  </span>
                </td>
                <td className="py-2 max-w-md">
                  <p className="truncate">{report.contentSnapshot}</p>
                  <Link
                    to={`/boards/${report.boardId}/threads/${report.threadId}`}
                    className="text-xs text-primary hover:underline"
                  >
                    スレッドを見る
                  </Link>
                </td>
                <td className="py-2 text-gray-400">{formatDate(report.createdAt)}</td>
                <td className="py-2 text-right whitespace-nowrap">
                  {report.status === 'open' ? (
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outlined"
                        disabled={processingId === report.id}
                        onClick={() => handleSetStatus(report.id, 'dismiss')}
                      >
                        却下
                      </Button>
                      <Button
                        variant="filled"
                        disabled={processingId === report.id}
                        onClick={() => handleSetStatus(report.id, 'resolve')}
                      >
                        対応済みにする
                      </Button>
                    </div>
                  ) : (
                    <span className="text-gray-500">{STATUS_LABELS[report.status]}</span>
                  )}
                </td>
              </tr>
            ))}
            {data?.data.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-gray-500">通報はありません</td>
              </tr>
            )}
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
