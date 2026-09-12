import { z } from 'zod'
import type { AclAction, PermissionGrant, ResourceAcl } from '../types'

// RBAC (ACL): 階層(admin>member>user>anon)を固定せず、任意のロール/ユーザーに
// 任意のアクション集合を自由に付与できる。owner は常にフルアクセス。
// grants に該当しない場合は authenticatedActions / anonymousActions にフォールバックする。

const ACTIONS: AclAction[] = ['read', 'create', 'update', 'delete']

export const aclActionSchema = z.enum(ACTIONS)

export const permissionGrantSchema: z.ZodType<PermissionGrant> = z.object({
  roleIds: z.array(z.string()).optional(),
  userIds: z.array(z.string()).optional(),
  actions: z.array(aclActionSchema),
})

export const resourceAclSchema: z.ZodType<ResourceAcl> = z.object({
  ownerUserId: z.string().nullable(),
  grants: z.array(permissionGrantSchema),
  authenticatedActions: z.array(aclActionSchema),
  anonymousActions: z.array(aclActionSchema),
})

export function isValidAcl(value: unknown): value is ResourceAcl {
  return resourceAclSchema.safeParse(value).success
}

// リクエストボディ用: ownerUserId はクライアントから指定させず、常にサーバー側で
// 作成者(または匿名=null)を設定する。
export const resourceAclInputSchema = z.object({
  grants: z.array(permissionGrantSchema).max(50).default([]),
  authenticatedActions: z.array(aclActionSchema),
  anonymousActions: z.array(aclActionSchema),
})
export type ResourceAclInput = z.infer<typeof resourceAclInputSchema>

export function buildAcl(input: ResourceAclInput, ownerUserId: string | null): ResourceAcl {
  return { ownerUserId, ...input }
}

// 指定アクションを実行する権限があるか判定する。
// isSysAdmin=true の場合は常に許可 (全権限バイパス)。
export function can(
  acl: ResourceAcl,
  ctx: { userId: string | null; userRoleIds: string[]; isSysAdmin: boolean },
  action: AclAction,
): boolean {
  if (ctx.isSysAdmin) return true
  if (ctx.userId && acl.ownerUserId === ctx.userId) return true

  for (const grant of acl.grants) {
    if (!grant.actions.includes(action)) continue
    if (ctx.userId && grant.userIds?.includes(ctx.userId)) return true
    if (grant.roleIds?.some((r) => ctx.userRoleIds.includes(r))) return true
  }

  if (ctx.userId && acl.authenticatedActions.includes(action)) return true
  return acl.anonymousActions.includes(action)
}

// ACL自体(grants/authenticatedActions/anonymousActions)の書き換えを許可するかの判定。
// 通常のcan(acl, ctx, 'update')より厳しい: 'update'権限は「コンテンツの編集」を
// 意図したものであり、grants経由でそれを付与された非オーナーが権限体系そのものを
// 書き換えて自身に delete を追加する、といった権限昇格の踏み台にされないようにする。
export function isOwnerOrSysAdmin(
  acl: ResourceAcl,
  ctx: { userId: string | null; isSysAdmin: boolean },
): boolean {
  if (ctx.isSysAdmin) return true
  return !!ctx.userId && acl.ownerUserId === ctx.userId
}

// board の defaultThreadAcl/defaultPostAcl のようなテンプレートから
// 実際のリソース (thread/post) 用の ACL を作る。
// 旧 $CREATOR/$PARENTS のテンプレート展開に相当するが、grants/authenticatedActions/
// anonymousActions はテンプレートの値をそのまま引き継ぎ、ownerUserId だけを
// 作成者(またはnull=匿名)で上書きする単純な構造クローンになる。
export function instantiateAcl(template: ResourceAcl, creatorUserId: string | null): ResourceAcl {
  return {
    ownerUserId: creatorUserId,
    grants: template.grants.map((g) => ({ ...g, actions: [...g.actions] })),
    authenticatedActions: [...template.authenticatedActions],
    anonymousActions: [...template.anonymousActions],
  }
}

// システムデフォルトのACL: 作成者がオーナー、ログイン済みは閲覧+投稿可、匿名は閲覧+投稿可。
// schema/init.sql の初期データや、板の初期値に使う。
export function defaultAcl(): ResourceAcl {
  return {
    ownerUserId: null,
    grants: [],
    authenticatedActions: ['read', 'create'],
    anonymousActions: ['read', 'create'],
  }
}
