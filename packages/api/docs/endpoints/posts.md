# エンドポイント: 投稿 (Posts)

ベースパス: `{API_BASE_PATH}/boards/:boardId/threads/:threadId/posts`

## 概要

投稿 (Post) の作成・取得・更新・削除を行う。

- **PUT**: 投稿内容 (本文・名前等) を冪等に置換する。`isEdited` フラグが立つ。
- **PATCH**: 投稿の権限設定 (`acl`) の部分更新。
- **DELETE**: ソフトデリート。物理削除はなし。`isDeleted` フラグが `true` になり、表示系フィールドが空文字に置き換えられる。レスポンスは常に `204 No Content` (ボディ無し)。削除後の表示が必要なら改めて `GET` する。削除テキストの表示 (「あぼーん」等) はフロントエンド側で行う。

### Post スキーマ

```jsonc
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "threadId": "550e8400-e29b-41d4-a716-446655440000",
  "postNumber": 1,                    // スレッド内の投稿番号 (1始まり)
  "acl": {
    "ownerUserId": "user123",
    "grants": [],
    "authenticatedActions": ["read", "create", "update", "delete"],
    "anonymousActions": ["read", "create"]
  },
  "authorId": "Ab3xY7q9",             // idFormat に従って計算された表示ID
  "posterName": "名無しさん",
  "posterOptionInfo": "",             // メール欄等の補助情報
  "content": "投稿本文",
  "isDeleted": false,
  "isEdited": false,
  "editedAt": null,
  "createdAt": "2026-01-01T00:00:00.000Z",
  // adminMeta: admin-role または user-admin-role メンバーのみ返却
  "adminMeta": {
    "creatorUserId": "user123",
    "creatorSessionId": "session-uuid",
    "creatorTurnstileSessionId": "turnstile-uuid"
  }
}
```

#### ソフトデリート後のレスポンス

`isDeleted: true` の投稿は `posterName`・`posterOptionInfo`・`authorId`・`content` が空文字 `""` に置き換えられる。
投稿番号・`createdAt` 等その他フィールドはそのまま保持される。

```json
{
  "postNumber": 3,
  "posterName": "",
  "posterOptionInfo": "",
  "authorId": "",
  "content": "",
  "isDeleted": true,
  "isEdited": false,
  "editedAt": null,
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

---

## `GET /boards/:boardId/threads/:threadId/posts`

投稿一覧を取得する (limit/cursorページネーション、詳細は[README.md](./README.md#ページネーションlimitcursor))。
`postNumber` の昇順で返る。スレッドの read 権限が必要。

### クエリパラメータ

`?limit=20&cursor=<opaque>` (両方省略可)。カーソルは前ページ最後の `postNumber` を指す。

### 認証

不要

### レスポンス

- `200 OK`

```json
{
  "data": [ "...Post オブジェクトの配列..." ],
  "nextCursor": "eyJwb3N0TnVtYmVyIjoyMH0" // 次ページが無ければ null
}
```

### エラー

| コード | HTTP | 説明 |
|---|---|---|
| `THREAD_NOT_FOUND` | 404 | スレッドが存在しない、または read 権限なし |

---

## `POST /boards/:boardId/threads/:threadId/posts`

投稿を作成する。スレッドの **create 権限**が必要。

### 認証

- `X-Turnstile-Session` 必須 (ENABLE_TURNSTILE=true 時)

### リクエストボディ

```json
{
  "content": "投稿本文",
  "posterName": "投稿者名 (省略時はスレッド→ボードのデフォルト)",
  "posterOptionInfo": "メール欄等 (省略可)"
}
```

### レスポンス

- `201 Created` — 作成した `Post` オブジェクト

### エラー

| コード | HTTP | 説明 |
|---|---|---|
| `VALIDATION_ERROR` | 400 | バリデーション失敗 |
| `FORBIDDEN` | 403 | create 権限なし |
| `THREAD_NOT_FOUND` | 404 | スレッドが存在しない |
| `POST_LIMIT_REACHED` | 422 | 投稿数が上限に達した |
| `CONTENT_TOO_LONG` | 422 | 本文が文字数制限を超過 |
| `CONTENT_TOO_MANY_LINES` | 422 | 本文が行数制限を超過 |
| `RATE_LIMIT_EXCEEDED` | 429 | `POST_CREATE_RATE_LIMIT` の上限に達した |

---

## `GET /boards/:boardId/threads/:threadId/posts/:postNumber`

指定した投稿番号の投稿を取得する。スレッドの read 権限が必要。

`:postNumber` はスレッド内の投稿番号 (1始まりの整数)。

### 認証

不要

### レスポンス

- `200 OK` — `Post` オブジェクト

### エラー

| コード | HTTP | 説明 |
|---|---|---|
| `VALIDATION_ERROR` | 400 | postNumber が正の整数でない |
| `POST_NOT_FOUND` | 404 | 投稿が存在しない、または read 権限なし |

---

## `PUT /boards/:boardId/threads/:threadId/posts/:postNumber`

投稿の **内容** (本文・投稿者名・posterOptionInfo) を冪等に置換し、`isEdited` フラグを立てる。
投稿の **update 権限**が必要。権限設定を変更したい場合は `PATCH` を使用する。

### 認証

- `X-Turnstile-Session` 必須

### リクエストボディ

```jsonc
{
  "content": "新しい本文",                // 必須、最大 10000 文字
  "posterName": "新しい投稿者名",          // 省略時 ''、最大 50 文字
  "posterOptionInfo": "新しいオプション"   // 省略時 ''、最大 100 文字
}
```

`posterName`・`posterOptionInfo` は省略すると空文字になる (以前の値は維持されない、全体置換のため)。

### レスポンス

- `200 OK` — 更新後の `Post` オブジェクト

### エラー

| コード | HTTP | 説明 |
|---|---|---|
| `VALIDATION_ERROR` | 400 | バリデーション失敗 |
| `FORBIDDEN` | 403 | 権限不足 |
| `POST_NOT_FOUND` | 404 | 投稿が存在しない |

---

## `PATCH /boards/:boardId/threads/:threadId/posts/:postNumber`

投稿の **権限設定** (`acl`) を部分更新する（upsertしない）。
投稿の **update 権限**が必要。ログインが必要。

`isEdited` フラグは変更されない。

### 認証

- `Authorization: Bearer <sessionId>` 必須
- `X-Turnstile-Session` 必須

### リクエストボディ

```jsonc
{
  // acl.ownerUserId はリクエストボディに含めない (既存のownerが維持される)
  "acl": {
    "grants": [{ "roleIds": ["moderator-role"], "actions": ["read", "update", "delete"] }],
    "authenticatedActions": ["read", "create", "update", "delete"],
    "anonymousActions": ["read", "create"]
  }
}
```

### レスポンス

- `200 OK` — 更新後の `Post` オブジェクト

### エラー

| コード | HTTP | 説明 |
|---|---|---|
| `VALIDATION_ERROR` | 400 | バリデーション失敗 |
| `FORBIDDEN` | 403 | 権限不足 |
| `POST_NOT_FOUND` | 404 | 投稿が存在しない |

---

## `DELETE /boards/:boardId/threads/:threadId/posts/:postNumber`

投稿をソフトデリートする。投稿の **delete 権限**が必要。
物理削除はなく、`isDeleted` フラグが立てられる。板・スレッドの `DELETE` と挙動を揃えるため、
成功時は常に `204 No Content` (ボディ無し) を返す。削除後の表示が必要な場合は改めて `GET` する。

### 認証

- `X-Turnstile-Session` 必須

### レスポンス

- `204 No Content`

### エラー

| コード | HTTP | 説明 |
|---|---|---|
| `FORBIDDEN` | 403 | 権限不足 |
| `POST_NOT_FOUND` | 404 | 投稿が存在しない |
