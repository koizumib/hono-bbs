# 環境変数リファレンス

hono-bbs 本体 (`packages/api`) の環境変数一覧です。`turnstile`/`imageUpload` は本体に統合済みの機能
（[`src/features/`](../src/features)）としてここに含む。twoCh/datImport は廃止済みのため掲載しない。

設定方法は「本番: `wrangler.jsonc` の `vars` または `wrangler secret put`」「ローカル: `.dev.vars`」のいずれか。
本番でどちらに設定すべきかは、この表の「種別」列の通り: **`vars` = 非機密、`secret` = 機密**。
機密でない値を誤って `wrangler secret put` に入れても動作はするが、`wrangler.jsonc` を見るだけでは値が追えなくなり、
変更のたびに再設定が必要になるので推奨しない。

---

## Cloudflare Workers バインディング

| 変数名 | 種別 | 必須 | 説明 |
|---|---|---|---|
| `DB` | D1 binding | ✅ | Cloudflare D1 データベース |
| `SESSION_KV` | KV binding | ✅ | セッション・Turnstileトークン保存先 KV |
| `IMAGE_KV` | KV binding | | 画像アップロードのレート制限用 (任意、未設定時はレート制限無効) |

## vars（非機密、`wrangler.jsonc` の `vars` に設定）

| 変数名 | デフォルト | 説明 |
|---|---|---|
| `API_BASE_PATH` | `/api/v1` | APIベースパス |
| `CORS_ORIGIN` | `*` | 許可するCORSオリジン (カンマ区切り) |
| `BBS_ALLOW_DOMAIN` | *(制限なし)* | アクセスを許可するドメイン (`Host`ヘッダーチェック、カンマ区切り) |
| `MAX_REQUEST_SIZE` | *(無制限)* | リクエストボディサイズ上限 (例: `1mb`, `500kb`) |
| `USER_DISPLAY_LIMIT` | `0` (無制限) | ユーザ一覧の1ページあたり件数 |
| `ROLE_DISPLAY_LIMIT` | `0` (無制限) | ロール一覧の1ページあたり件数 |
| `ADMIN_USERNAME` | `admin` | 管理者ユーザID (変更時は`schema/init.sql`の初期データも合わせる) |
| `USER_ADMIN_ROLE` | `user-admin-role` | ユーザ管理ロールID |
| `KV_PREFIX` | *(なし)* | KVキーのグローバルプレフィックス (同一KVを複数インスタンスで共有する場合の衝突防止) |
| `ENABLE_TURNSTILE` | *(未設定=検証スキップ)* | `"true"` で書き込み系エンドポイントの `X-Turnstile-Session` 検証を有効化 |
| `ALLOW_BBS_UI_DOMAINS` | *(リダイレクトなし)* | Turnstile認証後のリダイレクト許可UIドメイン (カンマ区切り) |
| `TURNSTILE_SITE_KEY` | | Cloudflare Turnstileのサイトキー (公開値、フロントに埋め込まれる) |
| `UPLOAD_RATE_LIMIT` / `UPLOAD_RATE_WINDOW` | `0` (無制限) | 画像アップロードのレート制限 (件数/分) |
| `ALLOWED_CONTENT_TYPES` / `MAX_IMAGE_SIZE` / `IMAGE_TTL_DAYS` | | 画像アップロードの制限設定 |
| `IMAGE_PUBLIC_BASE_URL` | | 画像の公開URLベース (CDNまたはR2パブリックURL) |
| `S3_ENDPOINT` / `S3_BUCKET` / `S3_REGION` | `S3_REGION`は`auto` | 画像保存先 (R2/S3互換) の接続先。エンドポイント自体は機密情報ではない |

## secrets（機密、`wrangler secret put <KEY>` で設定）

| 変数名 | 必須 | 説明 |
|---|---|---|
| `ADMIN_INITIAL_PASSWORD` | ✅ | admin初期パスワード (`POST /auth/setup`で使用、設定後は削除推奨) |
| `TURNSTILE_SECRET_KEY` | | Cloudflare Turnstileのシークレットキー (Turnstile使用時必須) |
| `TURNSTILE_SESSION_PEPPER` | | Turnstileセッション ID生成用ペッパー |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | | 画像保存先 (R2/S3互換) の認証情報 (画像アップロード機能使用時必須) |
| `ADMIN_API_KEY` | | 画像削除の管理者エンドポイント用Bearerトークン |

---

## ローカル開発 (`.dev.vars`)

ローカルでは `vars`/`secret` の区別なく、すべて `.dev.vars`（`.dev.vars.example`をコピー）に平文で書く。

```ini
API_BASE_PATH=/api/v1
ADMIN_INITIAL_PASSWORD=your-local-password
CORS_ORIGIN=http://localhost:5173
# ENABLE_TURNSTILE は設定しない (ローカルではTurnstile検証をスキップ)
```

---

## KVキー設計

`KV_PREFIX` を設定すると、同一KV Namespaceを複数環境（本番/ステージング等）で共有する際にキーが衝突しない。

| 用途 | キープレフィックス | 例 |
|---|---|---|
| セッション | `session:` | `session:abc123` |
| Turnstileトークン | `turnstile:` | `turnstile:xyz789` |
| グローバル (環境分離) | `KV_PREFIX` | `prod:session:abc123` |
