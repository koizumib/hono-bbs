# エンドポイント: `/auth/logout`

ベースパス: `{API_BASE_PATH}/auth/logout`

## 概要

ログアウトし、ユーザセッションを無効化する。

### 役割・実装の説明

`Authorization: Bearer <sessionId>` ヘッダーで指定されたセッションを KV から削除する。
削除後はそのセッション ID を使った操作はすべて `401 UNAUTHORIZED` になる。

---

## `POST /auth/logout`

ログアウトする。セッションを KV から削除する。

### 認証

- `Authorization: Bearer <sessionId>` 必須

### リクエスト

リクエストボディなし。

### レスポンス

- `204 No Content`

### エラー

| コード | HTTP | 説明 |
|---|---|---|
| `UNAUTHORIZED` | 401 | セッション ID が無効または存在しない |
