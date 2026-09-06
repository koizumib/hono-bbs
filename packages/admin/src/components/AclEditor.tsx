import { useQuery } from '@tanstack/react-query'
import type { ResourceAcl, PermissionGrant, AclAction, Role, User } from '../api/types'
import { getRoles } from '../api/roles'
import { getUsers } from '../api/users'
import Button from './ui/Button'
import Card from './ui/Card'

const ACTIONS: AclAction[] = ['read', 'create', 'update', 'delete']
const ACTION_LABELS: Record<AclAction, string> = {
  read: '閲覧',
  create: '作成',
  update: '更新',
  delete: '削除',
}

// リクエストボディ用の acl 入力 (ownerUserId はサーバー側で自動設定されるため含めない)
export type AclInput = Omit<ResourceAcl, 'ownerUserId'>

function toggleAction(actions: AclAction[], action: AclAction): AclAction[] {
  return actions.includes(action)
    ? actions.filter((a) => a !== action)
    : [...actions, action]
}

function selectedOptions(select: HTMLSelectElement): string[] {
  return Array.from(select.selectedOptions).map((o) => o.value)
}

function ActionCheckboxes({
  actions,
  onChange,
}: {
  actions: AclAction[]
  onChange: (actions: AclAction[]) => void
}) {
  return (
    <div className="flex gap-4">
      {ACTIONS.map((action) => (
        <label key={action} className="flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={actions.includes(action)}
            onChange={() => onChange(toggleAction(actions, action))}
          />
          {ACTION_LABELS[action]}
        </label>
      ))}
    </div>
  )
}

function GrantRow({
  grant,
  roles,
  users,
  onChange,
  onRemove,
}: {
  grant: PermissionGrant
  roles: Role[]
  users: User[]
  onChange: (grant: PermissionGrant) => void
  onRemove: () => void
}) {
  return (
    <div className="flex flex-col gap-2 rounded border border-border-dark p-3">
      <div className="flex gap-2">
        <label className="flex-1 text-sm">
          roleIds (複数選択可)
          <select
            multiple
            className="mt-1 h-24 w-full rounded border border-border-dark bg-surface-dark-2 px-2 py-1 text-sm"
            value={grant.roleIds ?? []}
            onChange={(e) => {
              const roleIds = selectedOptions(e.target)
              onChange({ ...grant, roleIds: roleIds.length > 0 ? roleIds : undefined })
            }}
          >
            {roles.map((role) => (
              <option key={role.id} value={role.id}>{role.name} ({role.id})</option>
            ))}
          </select>
        </label>
        <label className="flex-1 text-sm">
          userIds (複数選択可)
          <select
            multiple
            className="mt-1 h-24 w-full rounded border border-border-dark bg-surface-dark-2 px-2 py-1 text-sm"
            value={grant.userIds ?? []}
            onChange={(e) => {
              const userIds = selectedOptions(e.target)
              onChange({ ...grant, userIds: userIds.length > 0 ? userIds : undefined })
            }}
          >
            {users.map((user) => (
              <option key={user.id} value={user.id}>{user.displayName} ({user.id})</option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex items-center justify-between">
        <ActionCheckboxes actions={grant.actions} onChange={(actions) => onChange({ ...grant, actions })} />
        <Button variant="danger" onClick={onRemove}>この行を削除</Button>
      </div>
    </div>
  )
}

interface AclEditorProps {
  label: string
  value: AclInput
  onChange: (value: AclInput) => void
  ownerUserId?: string | null
}

// ResourceAcl { ownerUserId, grants: PermissionGrant[], authenticatedActions, anonymousActions }
// を編集する再利用可能なコンポーネント。板/スレッド/投稿のACL編集、板のdefaultThreadAcl/defaultPostAcl
// テンプレート編集のいずれでも同じ形で使う。
export default function AclEditor({ label, value, onChange, ownerUserId }: AclEditorProps) {
  // grants の roleIds/userIds はタイポに気づけないフリーテキストではなく、実在のロール/ユーザーから選ぶ
  const { data: rolesRes } = useQuery({ queryKey: ['roles', 1], queryFn: () => getRoles(1) })
  const { data: usersRes } = useQuery({ queryKey: ['users', 1], queryFn: () => getUsers(1) })
  const roles = rolesRes?.data ?? []
  const users = usersRes?.data ?? []

  return (
    <Card className="flex flex-col gap-3 p-4">
      <h3 className="font-medium">{label}</h3>

      {ownerUserId !== undefined && (
        <p className="text-sm text-gray-400">
          owner: {ownerUserId ?? '(匿名 / なし)'} <span className="text-xs">(編集不可、常にフルアクセス)</span>
        </p>
      )}

      <div>
        <p className="mb-1 text-sm font-medium">ログイン済みユーザー (authenticatedActions)</p>
        <ActionCheckboxes
          actions={value.authenticatedActions}
          onChange={(authenticatedActions) => onChange({ ...value, authenticatedActions })}
        />
      </div>

      <div>
        <p className="mb-1 text-sm font-medium">匿名ユーザー (anonymousActions)</p>
        <ActionCheckboxes
          actions={value.anonymousActions}
          onChange={(anonymousActions) => onChange({ ...value, anonymousActions })}
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium">個別グラント (grants)</p>
          <Button
            variant="text"
            onClick={() =>
              onChange({
                ...value,
                grants: [...value.grants, { actions: [] }],
              })
            }
          >
            + 行を追加
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          {value.grants.map((grant, i) => (
            <GrantRow
              key={i}
              grant={grant}
              roles={roles}
              users={users}
              onChange={(g) => {
                const grants = [...value.grants]
                grants[i] = g
                onChange({ ...value, grants })
              }}
              onRemove={() => {
                onChange({ ...value, grants: value.grants.filter((_, j) => j !== i) })
              }}
            />
          ))}
          {value.grants.length === 0 && (
            <p className="text-sm text-gray-500">グラントはありません</p>
          )}
        </div>
      </div>
    </Card>
  )
}
