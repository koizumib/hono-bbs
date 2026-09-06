// IDの表示フォーマット
export type IdFormat =
  | 'daily_hash'           // 全員: userToken+日付の日毎ハッシュ (先頭10文字)
  | 'daily_hash_or_user'   // 匿名: 日毎ハッシュ / ログイン済み: ユーザID
  | 'api_key_hash'         // 全員: userTokenのハッシュ (先頭10文字)
  | 'api_key_hash_or_user' // 匿名: APIキーハッシュ / ログイン済み: ユーザID
  | 'none'                 // 表示なし

export type User = {
  id: string              // ログインID兼表示ID (変更不可)
  displayName: string
  bio: string | null
  email: string | null
  isActive: boolean
  primaryRoleId: string | null
  createdAt: string
  updatedAt: string
}

export type Role = {
  id: string
  name: string
  createdAt: string
}

export type Session = {
  id: string
  userId: string
  isActive: boolean
  createdAt: string
  expiresAt: string
}

export type TurnstileSession = {
  id: string
  createdAt: string
  expiresAt: string
  clientIP: string
  userAgent: string
}

// 管理者のみ参照可能な作成者情報
export type AdminMeta = {
  creatorUserId: string | null
  creatorSessionId: string | null
  creatorTurnstileSessionId: string | null
}

// ── RBAC (ACL) ──────────────────────────────────────────────
// board/thread/post 単位でリソースACLを持つ。階層(admin>member>user>anon)を
// 固定せず、任意のロール/ユーザーに任意のアクション集合を自由に付与できる。
export type AclAction = 'read' | 'create' | 'update' | 'delete'

export type PermissionGrant = {
  roleIds?: string[]     // roles テーブルのIDを持つユーザーに actions を付与
  userIds?: string[]     // 特定ユーザーIDに actions を付与
  actions: AclAction[]
}

export type ResourceAcl = {
  ownerUserId: string | null    // 作成者は常にフルアクセス。null=匿名作成(オーナー無し)
  grants: PermissionGrant[]     // 明示的なロール/ユーザー単位のグラント
  authenticatedActions: AclAction[]  // grants に該当しないログイン済みユーザーへのフォールバック
  anonymousActions: AclAction[]      // 未ログインユーザーへのフォールバック
}

export type Board = {
  id: string
  acl: ResourceAcl
  name: string
  description: string
  maxThreads: number            // 0=無制限
  maxThreadTitleLength: number  // 0=無制限
  defaultMaxPosts: number       // 0=無制限
  defaultMaxPostLength: number  // 0=無制限
  defaultMaxPostLines: number   // 0=無制限
  defaultMaxPosterNameLength: number    // 0=無制限
  defaultMaxPosterOptionLength: number  // 0=無制限
  defaultPosterName: string
  defaultIdFormat: IdFormat
  defaultThreadAcl: ResourceAcl  // スレッド作成時に instantiateAcl() でコピーされるテンプレート
  defaultPostAcl: ResourceAcl    // 投稿作成時に instantiateAcl() でコピーされるテンプレート
  category: string
  createdAt: string
  adminMeta: AdminMeta
}

export type Thread = {
  id: string
  boardId: string
  acl: ResourceAcl
  title: string
  maxPosts: number              // 0=ボードのデフォルトを継承
  maxPostLength: number         // 0=ボードのデフォルトを継承
  maxPostLines: number          // 0=ボードのデフォルトを継承
  maxPosterNameLength: number   // 0=ボードのデフォルトを継承
  maxPosterOptionLength: number // 0=ボードのデフォルトを継承
  posterName: string            // ''=ボードのデフォルトを継承
  idFormat: string              // ''=ボードのデフォルトを継承
  postCount: number
  isEdited: boolean
  editedAt: string | null
  createdAt: string
  updatedAt: string
  adminMeta: AdminMeta
  firstPost?: Post | null       // スレッド一覧取得時のみ含まれる
}

export type Post = {
  id: string
  threadId: string
  postNumber: number
  acl: ResourceAcl
  authorId: string              // idFormat に従って計算された表示ID
  posterName: string
  posterOptionInfo: string
  content: string
  isDeleted: boolean
  isEdited: boolean
  editedAt: string | null
  createdAt: string
  adminMeta: AdminMeta
}

import type { DbAdapter } from '../adapters/db'
import type { KvAdapter } from '../adapters/kv'

export type { DbAdapter, KvAdapter }

export type AppEnv = {
  Bindings: {
    // ── Cloudflare Workers ネイティブバインディング ──────────────
    DB?: D1Database
    SESSION_KV?: KVNamespace
    // ── 認証・セキュリティ ────────────────────────────────────────
    // 'true' でない限り、書き込み系エンドポイントのX-Turnstile-Session検証と
    // POST /auth/turnstile での本物のCloudflare siteverify呼び出しの両方をスキップする
    // (ローカル開発用。以前はこの2つが ENABLE_TURNSTILE / DISABLE_TURNSTILE という
    // 別々の変数だったが、常にセットで同じ値にする以外の使い道が無かったため統合した)
    ENABLE_TURNSTILE?: string
    ADMIN_INITIAL_PASSWORD?: string
    ADMIN_USERNAME?: string
    USER_ADMIN_ROLE?: string       // ユーザ管理ロールID (デフォルト: user-admin-role)
    // ── Turnstile トークン発行 (旧 turnstileApiToken プラグイン) ──────
    TURNSTILE_SITE_KEY?: string
    TURNSTILE_SECRET_KEY?: string
    TURNSTILE_SESSION_PEPPER?: string   // セッションID生成用ペッパー (wrangler secret put で設定推奨)
    TURNSTILE_TOKEN_TTL?: string        // 有効期限 (分単位, 0=無期限, デフォルト: 525600=1年)
    ALLOW_BBS_UI_DOMAINS?: string       // Turnstile認証後のリダイレクト許可UIドメイン (カンマ区切り)
    // ── 画像アップロード (旧 imageUploader プラグイン) ────────────────
    IMAGE_KV?: KVNamespace              // レート制限用 KV (未設定時はレート制限無効)
    UPLOAD_RATE_LIMIT?: string          // 単位時間内の最大アップロード数 (0=無制限)
    UPLOAD_RATE_WINDOW?: string         // 単位時間 (分, デフォルト: 60)
    S3_ENDPOINT?: string                // e.g. "https://xxx.r2.cloudflarestorage.com"
    S3_BUCKET?: string
    S3_REGION?: string                  // R2 は "auto", AWS S3 は "ap-northeast-1" 等
    S3_ACCESS_KEY_ID?: string
    S3_SECRET_ACCESS_KEY?: string
    IMAGE_PUBLIC_BASE_URL?: string      // 公開URL (CDN または R2 パブリックURLのベース)
    PRESIGNED_URL_TTL?: string          // Presigned URL 有効期限 (秒, デフォルト: 300)
    MAX_IMAGE_SIZE?: string             // 最大ファイルサイズ (バイト, 0=無制限)
    ALLOWED_CONTENT_TYPES?: string      // 許可 MIME タイプ (カンマ区切り)
    IMAGE_TTL_DAYS?: string             // 画像保持日数 (0=無期限)
    ADMIN_API_KEY?: string              // 画像管理エンドポイント用
    // ── レート制限 (スレッド/投稿作成) ────────────────────────────
    THREAD_CREATE_RATE_LIMIT?: string   // ウィンドウ内の最大スレッド作成数 (0=無制限)
    THREAD_CREATE_RATE_WINDOW?: string  // ウィンドウ幅 (分, デフォルト: 60)
    POST_CREATE_RATE_LIMIT?: string     // ウィンドウ内の最大投稿数 (0=無制限)
    POST_CREATE_RATE_WINDOW?: string    // ウィンドウ幅 (分, デフォルト: 60)
    TURNSTILE_VERIFY_RATE_LIMIT?: string   // ウィンドウ内の最大Turnstile検証試行数 (0=無制限)
    TURNSTILE_VERIFY_RATE_WINDOW?: string  // ウィンドウ幅 (分, デフォルト: 60)
    // ── API 設定 ─────────────────────────────────────────────────
    MAX_REQUEST_SIZE?: string
    API_BASE_PATH: string
    CORS_ORIGIN?: string
    BBS_ALLOW_DOMAIN?: string
    USER_DISPLAY_LIMIT?: string
    ROLE_DISPLAY_LIMIT?: string    // ロール一覧ページネーション件数 (0=無制限)
    KV_PREFIX?: string
  }
  Variables: {
    db: DbAdapter
    kv: KvAdapter
    userId: string | null
    isSysAdmin: boolean          // admin-role メンバー (全権限バイパス)
    isUserAdmin: boolean         // user-admin-role メンバー (ユーザ管理 + adminMeta 参照)
    userRoleIds: string[]        // ユーザが持つロールID一覧
    primaryRoleId: string | null
    sessionId: string | null        // Authorization: Bearer から抽出したログインセッションID (adminMeta用)
    turnstileSessionId: string | null // X-Turnstile-Session から抽出した値 (adminMeta用)
  }
}
