import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createRole } from '../api/roles'
import { PERMISSION_LABELS } from '../constants/permissions'
import ErrorBanner from '../components/ErrorBanner'
import Button from '../components/ui/Button'

export default function RoleFormPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [permissions, setPermissions] = useState<string[]>([])
  const [error, setError] = useState<unknown>(null)
  const [saving, setSaving] = useState(false)

  function togglePermission(permission: string) {
    setPermissions((prev) =>
      prev.includes(permission) ? prev.filter((p) => p !== permission) : [...prev, permission],
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await createRole({ name, permissions })
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

      <div className="text-sm">
        権限
        <div className="mt-1 flex flex-col gap-1.5">
          {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={permissions.includes(key)}
                onChange={() => togglePermission(key)}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <Button type="submit" variant="filled" disabled={saving} className="self-start px-4 py-2">
        {saving ? '作成中...' : '作成'}
      </Button>
    </form>
  )
}
