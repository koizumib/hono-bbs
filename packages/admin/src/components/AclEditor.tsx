import type { ResourceAcl, PermissionGrant, AclAction } from '../api/types'

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
  onChange,
  onRemove,
}: {
  grant: PermissionGrant
  onChange: (grant: PermissionGrant) => void
  onRemove: () => void
}) {
  return (
    <div className="flex flex-col gap-2 rounded border border-border-dark p-3">
      <div className="flex gap-2">
        <label className="flex-1 text-sm">
          roleIds (カンマ区切り)
          <input
            type="text"
            className="mt-1 w-full rounded border border-border-dark bg-surface-dark-2 px-2 py-1 text-sm"
            value={(grant.roleIds ?? []).join(',')}
            onChange={(e) => {
              const roleIds = e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
              onChange({ ...grant, roleIds: roleIds.length > 0 ? roleIds : undefined })
            }}
          />
        </label>
        <label className="flex-1 text-sm">
          userIds (カンマ区切り)
          <input
            type="text"
            className="mt-1 w-full rounded border border-border-dark bg-surface-dark-2 px-2 py-1 text-sm"
            value={(grant.userIds ?? []).join(',')}
            onChange={(e) => {
              const userIds = e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
              onChange({ ...grant, userIds: userIds.length > 0 ? userIds : undefined })
            }}
          />
        </label>
      </div>
      <div className="flex items-center justify-between">
        <ActionCheckboxes actions={grant.actions} onChange={(actions) => onChange({ ...grant, actions })} />
        <button
          type="button"
          onClick={onRemove}
          className="text-sm text-red-400 hover:underline"
        >
          この行を削除
        </button>
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
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border-dark bg-surface-dark p-4">
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
          <button
            type="button"
            className="text-sm text-primary hover:underline"
            onClick={() =>
              onChange({
                ...value,
                grants: [...value.grants, { actions: [] }],
              })
            }
          >
            + 行を追加
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {value.grants.map((grant, i) => (
            <GrantRow
              key={i}
              grant={grant}
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
    </div>
  )
}
