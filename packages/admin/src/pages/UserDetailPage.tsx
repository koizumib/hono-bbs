import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { getUser, updateUser, deleteUser, type UpdateUserInput } from '../api/users'
import ErrorBanner from '../components/ErrorBanner'

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [form, setForm] = useState<UpdateUserInput>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    if (!id) return
    getUser(id)
      .then((res) =>
        setForm({
          displayName: res.data.displayName,
          bio: res.data.bio,
          email: res.data.email,
          isActive: res.data.isActive,
        }),
      )
      .catch(setError)
      .finally(() => setLoading(false))
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!id) return
    setSaving(true)
    setError(null)
    try {
      await updateUser(id, form)
      navigate('/users')
    } catch (e) {
      setError(e)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!id) return
    if (!window.confirm(`ユーザー "${id}" を削除しますか？ (投稿は残ります)`)) return
    setError(null)
    try {
      await deleteUser(id)
      navigate('/users')
    } catch (e) {
      setError(e)
    }
  }

  if (loading) return <p className="text-sm text-gray-400">読み込み中...</p>

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">ユーザー: {id}</h1>
        <Link to="/users" className="text-sm text-primary hover:underline">一覧へ戻る</Link>
      </div>

      <ErrorBanner error={error} />

      <label className="text-sm">
        表示名
        <input
          type="text"
          value={form.displayName ?? ''}
          onChange={(e) => setForm((f: UpdateUserInput) => ({ ...f, displayName: e.target.value }))}
          className="mt-1 w-full rounded border border-border-dark bg-surface-dark-2 px-2 py-1.5"
        />
      </label>

      <label className="text-sm">
        自己紹介
        <textarea
          value={form.bio ?? ''}
          onChange={(e) => setForm((f: UpdateUserInput) => ({ ...f, bio: e.target.value }))}
          className="mt-1 w-full rounded border border-border-dark bg-surface-dark-2 px-2 py-1.5"
        />
      </label>

      <label className="text-sm">
        メールアドレス
        <input
          type="email"
          value={form.email ?? ''}
          onChange={(e) => setForm((f: UpdateUserInput) => ({ ...f, email: e.target.value }))}
          className="mt-1 w-full rounded border border-border-dark bg-surface-dark-2 px-2 py-1.5"
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.isActive ?? true}
          onChange={(e) => setForm((f: UpdateUserInput) => ({ ...f, isActive: e.target.checked }))}
        />
        アカウント有効
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
  )
}
