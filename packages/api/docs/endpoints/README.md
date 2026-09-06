# エンドポイント仕様書インデックス

ベースパス: `{API_BASE_PATH}` (デフォルト: `/api/v1`)

---

## 共通仕様

### リクエストヘッダー

| ヘッダー | 用途 |
|---|---|
| `Authorization: Bearer <sessionId>` | ログインセッションID (`POST /auth/login` で取得) |
| `X-Turnstile-Session` | Turnstile セッションID (`GET/POST /auth/turnstile` で取得)。`ENABLE_TURNSTILE=true` 時の全 POST/PUT/PATCH/DELETE で必要。「誰であるか」の資格情報ではなくBot対策チャレンジ通過の証跡なので `Authorization` ではなく専用ヘッダーのまま |

### レスポンス形式

成功時 (単一リソース): `{ "data": <payload> }`
成功時 (一覧、limit/cursorページネーション): `{ "data": [<payload>, ...], "nextCursor": string | null }`
エラー時: `{ "error": "ERROR_CODE", "message": "説明" }`

### ページネーション (`limit`/`cursor`)

一覧系エンドポイント (`GET /boards`、`GET /boards/:boardId/threads`、`GET /boards/:boardId/threads/:threadId/posts`) は
`?limit=20&cursor=<opaque>` で制御する。

| パラメータ | 説明 | デフォルト |
|---|---|---|
| `limit` | 1ページの件数 (1〜100) | `20` |
| `cursor` | 前ページのレスポンスの `nextCursor` をそのまま渡す。中身の形式は不透明 (opaque) として扱うこと | — (先頭から) |

`nextCursor` が `null` の場合、次ページは無い。ACLで閲覧不可なアイテムは一覧から除外されるため、
`data` の件数が `limit` より少なくても次ページが存在することがある。

---

## 権限システム (RBAC/ACL)

各リソース (板・スレッド・投稿) は `acl` フィールドを1つ持ち、誰が何を操作できるかを制御する。
固定の4階層 (admin>member>user>anon) ではなく、任意のロール/ユーザーに任意のアクションを
自由に付与できる。

```ts
type AclAction = 'read' | 'create' | 'update' | 'delete'

interface PermissionGrant {
  roleIds?: string[]      // roles のIDを持つユーザーに actions を付与
  userIds?: string[]      // 特定ユーザーIDに actions を付与
  actions: AclAction[]
}

interface ResourceAcl {
  ownerUserId: string | null        // 作成者は常にフルアクセス
  grants: PermissionGrant[]         // 明示的なロール/ユーザー単位のグラント
  authenticatedActions: AclAction[] // grants に該当しないログイン済みユーザーへのフォールバック
  anonymousActions: AclAction[]     // 未ログインユーザーへのフォールバック
}
```

判定順序: **owner** → **grants** (roleIds/userIds 一致) → **authenticatedActions** (ログイン済みなら) → **anonymousActions**。

**sys admin** (`admin-role` のメンバー) はすべての権限チェックをバイパスする。

**設定例:**
```json
{
  "ownerUserId": "user123",
  "grants": [
    { "roleIds": ["moderator-role"], "actions": ["read", "create", "update", "delete"] }
  ],
  "authenticatedActions": ["read", "create"],
  "anonymousActions": ["read"]
}
```

板作成時、`defaultThreadAcl`/`defaultPostAcl` にテンプレートとなる ACL を指定する。
スレッド/投稿作成時、このテンプレートが複製され `ownerUserId` だけが作成者 (または匿名なら `null`) で
上書きされる (`grants`/`authenticatedActions`/`anonymousActions` はテンプレートのままコピーされる)。

---

## adminMeta フィールド

板・スレッド・投稿レスポンスに含まれる作成者追跡フィールド。
**`admin-role`** または **`user-admin-role`** のメンバーのみレスポンスに含まれる。

```json
{
  "adminMeta": {
    "creatorUserId": "user123",
    "creatorSessionId": "session-uuid",
    "creatorTurnstileSessionId": "turnstile-uuid"
  }
}
```

---

## 権限フィルタリング

一覧取得 (`GET /boards`、`GET /boards/:boardId/threads`、`GET /boards/:boardId/threads/:threadId/posts`) では、
クライアントが `read` 権限を持たないオブジェクトはレスポンスから自動的に除外される。

---

## エンドポイント一覧

### 認証 (Auth)

| ファイル | エンドポイント | 説明 |
|---|---|---|
| [auth-setup.md](./auth-setup.md) | `POST /auth/setup` | admin 初期パスワード設定 (一回限り) |
| [auth-login.md](./auth-login.md) | `POST /auth/login` | ログイン |
| [auth-logout.md](./auth-logout.md) | `POST /auth/logout` | ログアウト |

> `GET/POST /auth/turnstile` は本体に統合されたエンドポイントです（旧 turnstileApiToken プラグインは廃止）。

### プロフィール (Profile)

| ファイル | エンドポイント | 説明 |
|---|---|---|
| [profile.md](./profile.md) | `GET/PUT/DELETE /profile` | 自分自身のプロフィール管理 |

### Identity

| ファイル | エンドポイント | 説明 |
|---|---|---|
| [identity-users.md](./identity-users.md) | `POST /identity/users` (誰でも可), `GET/PUT/DELETE /identity/users/:id` | ユーザー管理 |
| [identity-roles.md](./identity-roles.md) | `GET/POST /identity/roles`, `GET/PUT/DELETE /identity/roles/:id`, `POST/DELETE /identity/roles/:id/members/*` | ロール管理 (userAdminRole 専用) |

### 掲示板 (BBS)

| ファイル | エンドポイント | 説明 |
|---|---|---|
| [boards.md](./boards.md) | `GET /boards`, `POST /boards`, `GET/PUT/PATCH/DELETE /boards/:boardId` | 板の一覧・作成・更新・削除 |
| [threads.md](./threads.md) | `GET/POST /boards/:boardId/threads`, `GET/PUT/PATCH/DELETE /boards/:boardId/threads/:threadId` | スレッドの一覧・作成・更新・削除 |
| [posts.md](./posts.md) | `GET/POST /boards/:boardId/threads/:threadId/posts`, `GET/PUT/PATCH/DELETE .../posts/:postNumber` | 投稿の作成・取得・更新・ソフトデリート |

`PUT`はupsert（存在しなければ作成、存在すれば全フィールドを冪等に置換）、`PATCH`は既存リソースの
指定フィールドのみ部分更新（upsertしない）という意味で統一している。

---

## システムロール

| ID (デフォルト) | 環境変数 | 説明 |
|---|---|---|
| `user-admin-role` | `USER_ADMIN_ROLE` | ユーザー・ロール管理権限、adminMeta 参照権限 |
| `admin-role` | — | sys admin。全権限チェックをバイパス |
| `general-role` | — | 新規ユーザーのデフォルトロール |

`admin` ユーザーは全システムロールに所属する。
`admin` のユーザーIDは `ADMIN_USERNAME` 環境変数で変更可能 (デフォルト: `admin`)。

---

## 主な環境変数

| 変数名 | 説明 | デフォルト |
|---|---|---|
| `ENABLE_TURNSTILE` | `"true"` で `X-Turnstile-Session` ヘッダーを SESSION_KV で検証する | — (無効) |
| `ADMIN_INITIAL_PASSWORD` | `POST /auth/setup` で使用する初期パスワード | — |
| `ADMIN_USERNAME` | 管理者ユーザーID | `admin` |
| `USER_ADMIN_ROLE` | ユーザー管理ロールID | `user-admin-role` |
| `MAX_REQUEST_SIZE` | リクエストボディサイズ上限 (例: `1mb`, `500kb`) | 無制限 |
| `API_BASE_PATH` | API ベースパス | `/api/v1` |
| `CORS_ORIGIN` | 許可する CORS オリジン (カンマ区切り) | `*` |
| `BBS_ALLOW_DOMAIN` | 許可するドメイン (カンマ区切り、未設定で制限なし) | — |
| `USER_DISPLAY_LIMIT` | ユーザー一覧の1ページあたり件数 (0=無制限) | `0` |
| `ROLE_DISPLAY_LIMIT` | ロール一覧の1ページあたり件数 (0=無制限) | `0` |

> **Turnstile / 画像アップロード関連の設定** (`TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `S3_*` 等) の全一覧は
> [`docs/env-vars.md`](../env-vars.md) を参照してください。
