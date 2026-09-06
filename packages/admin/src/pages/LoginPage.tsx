import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../api/auth'
import { useAuthStore } from '../stores/authStore'
import ErrorBanner from '../components/ErrorBanner'

export default function LoginPage() {
  const navigate = useNavigate()
  const setSession = useAuthStore((s) => s.setSession)
  const [id, setId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await login(id, password)
      setSession(res.data.sessionId, res.data.userId, res.data.displayName, res.data.expiresAt)
      navigate('/boards')
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full items-center justify-center">
      <form onSubmit={handleSubmit} className="flex w-80 flex-col gap-3 rounded-lg border border-border-dark bg-surface-dark p-6">
        <h1 className="mb-2 text-lg font-medium">hono-bbs 管理画面</h1>
        <p className="text-sm text-gray-400">
          admin-role または user-admin-role に所属するアカウントでログインしてください。
        </p>
        <label className="text-sm">
          ID
          <input
            type="text"
            value={id}
            onChange={(e) => setId(e.target.value)}
            required
            className="mt-1 w-full rounded border border-border-dark bg-surface-dark-2 px-2 py-1.5"
          />
        </label>
        <label className="text-sm">
          パスワード
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1 w-full rounded border border-border-dark bg-surface-dark-2 px-2 py-1.5"
          />
        </label>
        <ErrorBanner error={error} />
        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? 'ログイン中...' : 'ログイン'}
        </button>
      </form>
    </div>
  )
}
