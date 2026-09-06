import type { AclAction, ResourceAcl } from '../api/types'

// バックエンド (packages/api/src/utils/acl.ts) の can() と同じロジック。
// 階層(admin>member>user>anon)を固定せず、owner/任意のロール・ユーザーへの
// 明示的なグラント/ログイン済み/未ログインのフォールバックで判定する。
export function canDo(
  acl: ResourceAcl,
  ctx: { userId: string | null; userRoleIds: string[] },
  action: AclAction,
): boolean {
  if (ctx.userId && acl.ownerUserId === ctx.userId) return true

  for (const grant of acl.grants) {
    if (!grant.actions.includes(action)) continue
    if (ctx.userId && grant.userIds?.includes(ctx.userId)) return true
    if (grant.roleIds?.some((r) => ctx.userRoleIds.includes(r))) return true
  }

  if (ctx.userId && acl.authenticatedActions.includes(action)) return true
  return acl.anonymousActions.includes(action)
}
