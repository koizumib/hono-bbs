// packages/api の utils/permissions.ts の PERMISSIONS と一致させる。
// isSysAdmin(admin-role)は常に全権限を持つのでロールへの割り当ては不要。
export const PERMISSION_LABELS: Record<string, string> = {
  manage_threads: 'スレッド管理（dat落ちの手動切替）',
}

export const PERMISSIONS = Object.keys(PERMISSION_LABELS)
