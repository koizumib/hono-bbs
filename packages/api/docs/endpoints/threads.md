# エンドポイント: `/boards/:boardId/threads` (スレッド)

ベースパス: `{API_BASE_PATH}/boards/:boardId/threads`

## 概要

スレッド (Thread) の一覧取得・作成・更新・削除を行う。
スレッド作成時は本文 (content) から第1レスが同時に作成される。

スレッドは独自の `acl` (RBAC/ACL) を持ち、投稿への権限設定とは独立している。

### Thread スキーマ

```jsonc
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "boardId": "general",
  "acl": {
    "ownerUserId": "user123",
    "grants": [],
    "authenticatedActions": ["read", "create", "update", "delete"],
    "anonymousActions": ["read", "create"]
  },
  "title": "雑談スレ",
  "maxPosts": 0,              // 0=ボードのデフォルトを継承
  "maxPostLength": 0,         // 0=ボードのデフォルトを継承
  "maxPostLines": 0,          // 0=ボードのデフォルトを継承
  "maxPosterNameLength": 0,   // 0=ボードのデフォルトを継承
  "maxPosterOptionLength": 0, // 0=ボードのデフォルトを継承
  "posterName": "",           // ''=ボードのデフォルトを継承
  "idFormat": "",             // ''=ボードのデフォルトを継承
  "postCount": 10,
  "isEdited": false,
  "editedAt": null,
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-02T00:00:00.000Z",
  // adminMeta: admin-role または user-admin-role メンバーのみ返却
  "adminMeta": {
    "creatorUserId": "user123",
    "creatorSessionId": "session-uuid",
    "creatorTurnstileSessionId": "turnstile-uuid"
  }
}
```

---

## `GET /boards/:boardId/threads`

スレッド一覧を取得する (limit/cursorページネーション、詳細は[README.md](./README.md#ページネーションlimitcursor))。
板の read 権限が必要。スレッド個別に read 権限チェックが行われ、権限のないスレッドは除外される。

### クエリパラメータ

`?limit=20&cursor=<opaque>` (両方省略可)

### 認証

不要 (ただし認証によって見えるスレッドが変わる)

### レスポンス

- `200 OK`

```json
{
  "data": [ "...Thread オブジェクトの配列..." ],
  "nextCursor": "eyJ1cGRhdGVkQXQiOi4uLn0" // 次ページが無ければ null
}
```

### エラー

| コード | HTTP | 説明 |
|---|---|---|
| `BOARD_NOT_FOUND` | 404 | 板が存在しない、または read 権限なし |

---

## `POST /boards/:boardId/threads`

スレッドを作成する。同時に第1レスも作成される。
板の **create 権限**が必要。

### 認証

- `X-Turnstile-Session` 必須 (ENABLE_TURNSTILE=true 時)

### リクエストボディ

```json
{
  "title": "スレッドタイトル",
  "content": "本文 (第1レスの内容)",
  "posterName": "投稿者名 (省略時はボードのデフォルト)",
  "posterOptionInfo": "メール欄等 (省略可)"
}
```

### レスポンス

- `201 Created`

```json
{
  "data": {
    "thread": { "...": "Thread オブジェクト" },
    "firstPost": { "...": "Post オブジェクト (第1レス)" }
  }
}
```

### エラー

| コード | HTTP | 説明 |
|---|---|---|
| `VALIDATION_ERROR` | 400 | バリデーション失敗 |
| `BOARD_NOT_FOUND` | 404 | 板が存在しない |
| `FORBIDDEN` | 403 | create 権限なし |
| `THREAD_LIMIT_REACHED` | 422 | スレッド数が上限に達した |
| `TITLE_TOO_LONG` | 422 | タイトルが文字数制限を超過 |
| `CONTENT_TOO_LONG` | 422 | 本文が文字数制限を超過 |
| `CONTENT_TOO_MANY_LINES` | 422 | 本文が行数制限を超過 |
| `RATE_LIMIT_EXCEEDED` | 429 | `THREAD_CREATE_RATE_LIMIT` の上限に達した |

---

## `GET /boards/:boardId/threads/:threadId`

スレッド情報を取得する（投稿一覧は含まない。投稿一覧は [posts.md](./posts.md) の
`GET /boards/:boardId/threads/:threadId/posts` で取得する）。
スレッドの read 権限が必要。

### 認証

不要 (ただし認証によって見えるかが変わる)

### レスポンス

- `200 OK` — `Thread` オブジェクト

### エラー

| コード | HTTP | 説明 |
|---|---|---|
| `THREAD_NOT_FOUND` | 404 | スレッドが存在しない、または read 権限なし |

---

## `PUT /boards/:boardId/threads/:threadId`

スレッドをupsertする（存在しなければ作成、存在すれば全フィールドを冪等に置換する）。
`isEdited` は変更しない (内容編集ではなくメタデータの全体置換のため)。

- **スレッドが存在しない場合**: **sys admin のみ** 新規作成できる (指定した `:threadId` で作成)。
- **スレッドが存在する場合**: スレッドの **update 権限**が必要。全フィールドを丸ごと置換する（省略したフィールドはスキーマのデフォルト値になる）。

### 認証

- `Authorization: Bearer <sessionId>` 必須
- `X-Turnstile-Session` 必須

### リクエストボディ

```jsonc
{
  "title": "タイトル",             // 必須
  "posterName": "デフォルト投稿者名", // 省略時 ''
  // acl.ownerUserId はリクエストボディに含めない (作成者/既存ownerが自動設定される)
  "acl": {
    "grants": [{ "roleIds": ["moderator-role"], "actions": ["read", "create", "update", "delete"] }],
    "authenticatedActions": ["read", "create", "update", "delete"],
    "anonymousActions": ["read", "create"]
  },
  "maxPosts": 500,                 // 省略時 0 (ボードのデフォルト継承)
  "maxPostLength": 2000,
  "maxPostLines": 100,
  "maxPosterNameLength": 50,
  "maxPosterOptionLength": 100,
  "idFormat": "daily_hash"         // 省略時 '' (ボードのデフォルト継承)
}
```

`title`・`acl` は必須。それ以外は省略するとデフォルト値になる（既存の値は維持されない点に注意）。

### レスポンス

- `200 OK` — 更新後または作成した `Thread` オブジェクト

### エラー

| コード | HTTP | 説明 |
|---|---|---|
| `VALIDATION_ERROR` | 400 | バリデーション失敗 |
| `FORBIDDEN` | 403 | 権限不足 (スレッドが存在しない場合は sys admin でない) |
| `BOARD_NOT_FOUND` | 404 | 板が存在しない (作成時) |

---

## `PATCH /boards/:boardId/threads/:threadId`

既存スレッドの指定フィールドのみ部分更新する（**upsertしない**。スレッドが無ければ404）。
`isEdited` フラグは変更されない。

スレッドの **update 権限**が必要。

### 認証

- `Authorization: Bearer <sessionId>` 必須
- `X-Turnstile-Session` 必須

### リクエストボディ

`PUT`と同じフィールドの任意のサブセット。指定しなかったフィールドは変更されない。

```jsonc
{
  "acl": {
    "grants": [{ "roleIds": ["moderator-role"], "actions": ["read", "create", "update", "delete"] }],
    "authenticatedActions": ["read", "create", "update", "delete"],
    "anonymousActions": ["read", "create"]
  }
}
```

### レスポンス

- `200 OK` — 更新後の `Thread` オブジェクト

### エラー

| コード | HTTP | 説明 |
|---|---|---|
| `VALIDATION_ERROR` | 400 | バリデーション失敗 |
| `FORBIDDEN` | 403 | 権限不足 |
| `THREAD_NOT_FOUND` | 404 | スレッドが存在しない |

---

## `DELETE /boards/:boardId/threads/:threadId`

スレッドを削除する。CASCADE で投稿も削除される。スレッドの **delete 権限**が必要。

### 認証

- `Authorization: Bearer <sessionId>` 必須
- `X-Turnstile-Session` 必須

### レスポンス

- `204 No Content`

### エラー

| コード | HTTP | 説明 |
|---|---|---|
| `FORBIDDEN` | 403 | 権限不足 |
| `THREAD_NOT_FOUND` | 404 | スレッドが存在しない |
