import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getRole, updateRole, deleteRole, getRoleMembers, addRoleMember, removeRoleMember } from '../api/roles'
import { PERMISSION_LABELS } from '../constants/permissions'
import ErrorBanner from '../components/ErrorBanner'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'

export default function RoleDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [permissions, setPermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [memberUserId, setMemberUserId] = useState('')
  const [addingMember, setAddingMember] = useState(false)

  useEffect(() => {
    if (!id) return
    getRole(id)
      .then((res) => {
        setName(res.data.name)
        setPermissions(res.data.permissions)
      })
      .catch(setError)
      .finally(() => setLoading(false))
  }, [id])

  function togglePermission(permission: string) {
    setPermissions((prev) =>
      prev.includes(permission) ? prev.filter((p) => p !== permission) : [...prev, permission],
    )
  }

  const { data: members } = useQuery({
    queryKey: ['roleMembers', id],
    queryFn: () => getRoleMembers(id!),
    enabled: Boolean(id),
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!id) return
    setSaving(true)
    setError(null)
    try {
      await updateRole(id, { name, permissions })
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
    setAddingMember(true)
    setError(null)
    try {
      await addRoleMember(id, memberUserId)
      setMemberUserId('')
      await queryClient.invalidateQueries({ queryKey: ['roleMembers', id] })
    } catch (e) {
      setError(e)
    } finally {
      setAddingMember(false)
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!id) return
    setError(null)
    try {
      await removeRoleMember(id, userId)
      await queryClient.invalidateQueries({ queryKey: ['roleMembers', id] })
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

        <div className="flex gap-2">
          <Button type="submit" variant="filled" disabled={saving} className="px-4 py-2">
            {saving ? '保存中...' : '更新'}
          </Button>
          <Button variant="danger" onClick={handleDelete}>削除</Button>
        </div>
      </form>

      <Card className="flex flex-col gap-2 p-4">
        <h2 className="font-medium">メンバー</h2>

        <ul className="flex flex-col divide-y divide-border-dark">
          {members?.data.map((member) => (
            <li key={member.id} className="flex items-center justify-between py-1.5 text-sm">
              <span>{member.id} ({member.displayName})</span>
              <Button variant="danger" onClick={() => handleRemoveMember(member.id)}>削除</Button>
            </li>
          ))}
          {members?.data.length === 0 && (
            <li className="py-1.5 text-sm text-gray-500">メンバーはいません</li>
          )}
        </ul>

        <label className="text-sm">
          userIdを指定して追加
          <input
            type="text"
            value={memberUserId}
            onChange={(e) => setMemberUserId(e.target.value)}
            className="mt-1 w-full rounded border border-border-dark bg-surface-dark-2 px-2 py-1.5"
          />
        </label>
        <Button variant="filled" onClick={handleAddMember} disabled={addingMember || !memberUserId} className="self-start">
          {addingMember ? '追加中...' : '追加'}
        </Button>
      </Card>
    </div>
  )
}
