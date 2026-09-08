import type { InferResponseType } from 'hono/client'
import { client } from './rpcClient'

export interface ApiResponse<T> {
  data: T
}

// Board/Thread/Post/User/Role/ResourceAcl は packages/api の実際のレスポンス型 (hc<AdminAppType>())
// から導出する。バックエンドがレスポンス形状を変えると、ここが自動的に型エラーとして検知される。

type BoardsListResponse = InferResponseType<typeof client.boards.$get, 200>
export type BoardsResponse = BoardsListResponse
export type Board = BoardsListResponse['data'][number]

type ThreadsListResponse = InferResponseType<(typeof client.boards)[':boardId']['threads']['$get'], 200>
export type ThreadsResponse = ThreadsListResponse
export type Thread = ThreadsListResponse['data'][number]

type PostsListResponse = InferResponseType<
  (typeof client.boards)[':boardId']['threads'][':threadId']['posts']['$get'],
  200
>
export type PostsResponse = PostsListResponse
export type Post = PostsListResponse['data'][number]

export type ResourceAcl = Board['acl']
export type PermissionGrant = ResourceAcl['grants'][number]
export type AclAction = PermissionGrant['actions'][number]

type UsersListResponse = InferResponseType<typeof client.identity.users.$get, 200>
export type UsersResponse = UsersListResponse
export type User = UsersListResponse['data'][number]

type RolesListResponse = InferResponseType<typeof client.identity.roles.$get, 200>
export type RolesResponse = RolesListResponse
export type Role = RolesListResponse['data'][number]

type IpBansListResponse = InferResponseType<(typeof client.moderation)['ip-bans']['$get'], 200>
export type IpBansResponse = IpBansListResponse
export type IpBan = IpBansListResponse['data'][number]

type ReportsListResponse = InferResponseType<typeof client.moderation.reports.$get, 200>
export type ReportsResponse = ReportsListResponse
export type Report = ReportsListResponse['data'][number]

// 板ごとのサーバー側NGワード。adminMeta と同様 isSysAdmin/isUserAdmin にのみ返るフィールドで、
// stripBoard() の戻り値がUnion型になるため Board から直接は導出できない (管理画面は常に
// このロールでログインする前提なので手書きで補う)。
export type NgWordTarget = 'title' | 'posterName' | 'content'
export interface NgWordRule {
  pattern: string
  isRegex: boolean
  target: NgWordTarget
}

// admin-role/user-admin-role メンバーのみ返るフィールド (packages/api の responseShaping.ts 参照)。
// 管理画面は常にこのロールでログインする前提なので、Board から手書きで補う。
export interface AdminMeta {
  creatorUserId: string | null
  creatorSessionId: string | null
  creatorTurnstileSessionId: string | null
}

export interface LoginResponse {
  sessionId: string
  userId: string
  displayName: string
  expiresAt: string
}
