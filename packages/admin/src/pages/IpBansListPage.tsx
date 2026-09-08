import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getIpBans, createIpBan, deleteIpBan } from '../api/moderation'
import { formatDate } from '../utils/formatDate'
import ErrorBanner from '../components/ErrorBanner'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'

export default function IpBansListPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [ip, setIp] = useState('')
  const [reason, setReason] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['ipBans', page],
    queryFn: () => getIpBans(page),
  })

  const hasNextPage = (data?.limit ?? 0) > 0 && (data?.data.length ?? 0) === data?.limit

  async function handleAdd() {
    if (!ip.trim()) return
    setAdding(true)
    setError(null)
    try {
      await createIpBan({ ip: ip.trim(), reason: reason.trim() || undefined })
      setIp('')
      setReason('')
      await queryClient.invalidateQueries({ queryKey: ['ipBans'] })
    } catch (e) {
      setError(e)
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(id: string, targetIp: string) {
    if (!window.confirm(`IPBAN "${targetIp}" を解除しますか？`)) return
    setError(null)
    try {
      await deleteIpBan(id)
      await queryClient.invalidateQueries({ queryKey: ['ipBans'] })
    } catch (e) {
      setError(e)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-medium">IPBAN</h1>
      <p className="text-sm text-gray-400">
        書き込み系エンドポイント（スレ立て・レス・ユーザー登録など）のみをブロックします。閲覧(GET)は引き続き可能です。
      </p>

      <ErrorBanner error={error} />

      <Card className="flex flex-col gap-3 p-4">
        <h2 className="font-medium">IPBANを追加</h2>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            placeholder="IPアドレス"
            className="flex-1 min-w-[10rem] rounded border border-border-dark bg-surface-dark-2 px-2 py-1.5 text-sm font-mono"
          />
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="理由（任意）"
            className="flex-[2] min-w-[10rem] rounded border border-border-dark bg-surface-dark-2 px-2 py-1.5 text-sm"
          />
          <Button variant="filled" onClick={handleAdd} disabled={adding || !ip.trim()}>
            {adding ? '追加中...' : '追加'}
          </Button>
        </div>
      </Card>

      {isLoading ? (
        <p className="text-sm text-gray-400">読み込み中...</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-dark text-left text-gray-400">
              <th className="py-2">IP</th>
              <th className="py-2">理由</th>
              <th className="py-2">登録日</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {data?.data.map((ban) => (
              <tr key={ban.id} className="border-b border-border-dark">
                <td className="py-2 font-mono">{ban.ip}</td>
                <td className="py-2 text-gray-400">{ban.reason || '-'}</td>
                <td className="py-2 text-gray-400">{formatDate(ban.createdAt)}</td>
                <td className="py-2 text-right">
                  <Button variant="danger" onClick={() => handleDelete(ban.id, ban.ip)}>解除</Button>
                </td>
              </tr>
            ))}
            {data?.data.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-gray-500">IPBANはありません</td>
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
