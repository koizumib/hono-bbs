import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { getRole, updateRole, deleteRole, addRoleMember, removeRoleMember } from '../api/roles'
import ErrorBanner from '../components/ErrorBanner'

export default function RoleDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [memberUserId, setMemberUserId] = useState('')
  const [memberMessage, setMemberMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    getRole(id)
      .then((res) => setName(res.data.name))
      .catch(setError)
      .finally(() => setLoading(false))
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!id) return
    setSaving(true)
    setError(null)
    try {
      await updateRole(id, { name })
    } catch (e) {
      setError(e)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!id) return
    if (!window.confirm(`ロール "${id}" を削除しますか？`)) return
    setError(null)
    try {
      await deleteRole(id)
      navigate('/roles')
    } catch (e) {
      setError(e)
    }
  }

  async function handleAddMember() {
    if (!id || !memberUserId) return
    setMemberMessage(null)
    setError(null)
    try {
      await addRoleMember(id, memberUserId)
      setMemberMessage(`${memberUserId} を追加しました`)
      setMemberUserId('')
    } catch (e) {
      setError(e)
    }
  }

  async function handleRemoveMember() {
    if (!id || !memberUserId) return
    setMemberMessage(null)
    setError(null)
    try {
      await removeRoleMember(id, memberUserId)
      setMemberMessage(`${memberUserId} を削除しました`)
      setMemberUserId('')
    } catch (e) {
      setError(e)
    }
  }

  if (loading) return <p className="text-sm text-gray-400">読み込み中...</p>

  return (
    <div className="flex max-w-md flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">ロール: {id}</h1>
        <Link to="/roles" className="text-sm text-primary hover:underline">一覧へ戻る</Link>
      </div>

      <ErrorBanner error={error} />

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="text-sm">
          名前
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded border border-border-dark bg-surface-dark-2 px-2 py-1.5"
          />
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? '保存中...' : '更新'}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="rounded border border-red-500/50 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10"
          >
            削除
          </button>
        </div>
      </form>

      <div className="flex flex-col gap-2 rounded-lg border border-border-dark bg-surface-dark p-4">
        <h2 className="font-medium">メンバー管理</h2>
        <p className="text-xs text-gray-500">
          APIに「ロールのメンバー一覧取得」が無いため、現在の所属者は表示できません。
          userIdを指定して追加・削除のみ行えます。
        </p>
        <label className="text-sm">
          userId
          <input
            type="text"
            value={memberUserId}
            onChange={(e) => setMemberUserId(e.target.value)}
            className="mt-1 w-full rounded border border-border-dark bg-surface-dark-2 px-2 py-1.5"
          />
        </label>
        {memberMessage && <p className="text-sm text-green-400">{memberMessage}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleAddMember}
            className="rounded bg-primary px-3 py-1.5 text-sm text-white"
          >
            追加
          </button>
          <button
            type="button"
            onClick={handleRemoveMember}
            className="rounded border border-border-dark px-3 py-1.5 text-sm hover:bg-surface-dark-2"
          >
            削除
          </button>
        </div>
      </div>
    </div>
  )
}
