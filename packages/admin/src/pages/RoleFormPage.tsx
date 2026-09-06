import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createRole } from '../api/roles'
import ErrorBanner from '../components/ErrorBanner'

export default function RoleFormPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await createRole({ name })
      navigate('/roles')
    } catch (e) {
      setError(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
      <h1 className="text-lg font-medium">ロールを作成</h1>

      <ErrorBanner error={error} />

      <label className="text-sm">
        名前 (英数字・_・- のみ)
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded border border-border-dark bg-surface-dark-2 px-2 py-1.5"
        />
      </label>

      <button
        type="submit"
        disabled={saving}
        className="self-start rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {saving ? '作成中...' : '作成'}
      </button>
    </form>
  )
}
