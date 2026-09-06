// 共通
export interface ApiResponse<T> {
  data: T
  endpoint?: EndpointMeta
}

export interface EndpointMeta {
  acl: ResourceAcl
}

export interface ApiError {
  error: string
  message: string
  errorCodes?: string[]
}

// RBAC (ACL): board/thread/post 単位のリソースACL。バックエンド (packages/api) と同じ形。
export type AclAction = 'read' | 'create' | 'update' | 'delete'

export interface PermissionGrant {
  roleIds?: string[]
  userIds?: string[]
  actions: AclAction[]
}

export interface ResourceAcl {
  ownerUserId: string | null
  grants: PermissionGrant[]
  authenticatedActions: AclAction[]
  anonymousActions: AclAction[]
}

// Board
export type IdFormat =
  | 'daily_hash'
  | 'daily_hash_or_user'
  | 'api_key_hash'
  | 'api_key_hash_or_user'
  | 'none'

export interface Board {
  id: string
  acl: ResourceAcl
  name: string
  description: string | null
  maxThreads: number
  maxThreadTitleLength: number
  defaultMaxPosts: number
  defaultMaxPostLength: number
  defaultMaxPostLines: number
  defaultMaxPosterNameLength: number
  defaultMaxPosterOptionLength: number
  defaultPosterName: string
  defaultIdFormat: IdFormat
  defaultThreadAcl: ResourceAcl
  defaultPostAcl: ResourceAcl
  category: string | null
  createdAt: string
  adminMeta?: AdminMeta
}

// Thread
export interface Thread {
  id: string
  boardId: string
  acl: ResourceAcl
  title: string
  maxPosts: number | null
  maxPostLength: number | null
  maxPostLines: number | null
  maxPosterNameLength: number | null
  maxPosterOptionLength: number | null
  posterName: string | null
  idFormat: IdFormat | null
  postCount: number
  isEdited: boolean
  editedAt: string | null
  createdAt: string
  updatedAt: string
  firstPost?: Post
  adminMeta?: AdminMeta
}

// Post
export interface Post {
  id: string
  threadId: string
  postNumber: number
  acl: ResourceAcl
  authorId: string
  posterName: string
  posterOptionInfo: string
  content: string
  isDeleted: boolean
  isEdited: boolean
  editedAt: string | null
  createdAt: string
  adminMeta?: AdminMeta
}

// AdminMeta
export interface AdminMeta {
  creatorUserId: string | null
  creatorSessionId: string | null
  creatorTurnstileSessionId: string | null
}

// Profile
export interface Profile {
  id: string
  displayName: string
  bio: string | null
  email: string | null
  isActive: boolean
  primaryRoleId: string | null
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

// Boards list response
export interface BoardsResponse {
  data: Board[]
  endpoint: EndpointMeta
}

// Board threads response
export interface BoardThreadsResponse {
  data: {
    board: Board
    threads: Thread[]
  }
}

// Thread posts response
export interface ThreadPostsResponse {
  data: {
    thread: Thread
    posts: Post[]
  }
}

// Create thread response
export interface CreateThreadResponse {
  data: {
    thread: Thread
    firstPost: Post
  }
}
