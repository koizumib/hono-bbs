import type { DbAdapter } from '../adapters/db'
import * as roleRepository from '../repository/roleRepository'

// ロールに割り当てられる個別の管理権限。isSysAdmin(admin-role)は常に全権限を持つため
// ここには依らない (hasPermission内で先にバイパスする)。今後増やす場合はここに追記する。
export const PERMISSIONS = ['manage_threads'] as const
export type Permission = (typeof PERMISSIONS)[number]

// ユーザが持つロールのいずれかに指定した権限が含まれているか判定する。
// isSysAdmin は常に true (全権限バイパス)。
export async function hasPermission(
  db: DbAdapter,
  userRoleIds: string[],
  isSysAdmin: boolean,
  permission: Permission,
): Promise<boolean> {
  if (isSysAdmin) return true
  if (userRoleIds.length === 0) return false
  const roles = await roleRepository.findRolesByIds(db, userRoleIds)
  return roles.some((r) => r.permissions.includes(permission))
}
