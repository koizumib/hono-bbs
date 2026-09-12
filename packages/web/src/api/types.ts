import type { InferResponseType } from 'hono/client'
import { client } from './rpcClient'

// 共通
export interface ApiResponse<T> {
  data: T
}

export interface ApiError {
  error: string
  message: string
  errorCodes?: string[]
}

// Board/Thread/Post/ResourceAcl は packages/api の実際のレスポンス型 (hc<AppType>()) から導出する。
// バックエンドがレスポンス形状を変えると、ここが自動的に型エラーとして検知される
// (手書きコピーによる「フロントが気づかないまま実行時に壊れる」問題への対策)。

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
export type IdFormat = Board['defaultIdFormat']

// admin-role/user-admin-role メンバー以外にはレスポンスから省かれるフィールドなので
// (packages/api の responseShaping.ts 参照)、Board 自体は「あり/なし」のユニオン型になる。
// AdminMeta 自体は小さく安定した形なので手書きのまま維持する。
export interface AdminMeta {
  creatorUserId: string | null
  creatorSessionId: string | null
  creatorTurnstileSessionId: string | null
}

// Profile (auth/profile系は今回のRPC化のスコープ外。引き続き手書き)
export interface Profile {
  id: string
  displayName: string
  bio: string | null
  email: string | null
  isActive: boolean
  primaryRoleId: string | null
  preferences: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

// Auth
export interface LoginResponse {
  sessionId: string
  userId: string
  displayName: string
  expiresAt: string
}

export interface TurnstileResponse {
  sessionId: string
  alreadyIssued: boolean
}

// 板 + スレッド一覧をまとめたもの (フロント側で2リクエストを合成して作る。API本体はこの形では返さない)
export interface BoardThreadsResponse {
  data: {
    board: Board
    threads: Thread[]
  }
}

// スレッド + 投稿一覧をまとめたもの (フロント側で2リクエストを合成して作る。API本体はこの形では返さない)
export interface ThreadPostsResponse {
  data: {
    thread: Thread
    posts: Post[]
  }
}

// Create thread response
type CreateThreadApiResponse = InferResponseType<(typeof client.boards)[':boardId']['threads']['$post'], 201>
export type CreateThreadResponse = CreateThreadApiResponse
