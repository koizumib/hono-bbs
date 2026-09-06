# hono-bbs (packages/api)

Hono + Cloudflare Workers + D1 で動く匿名掲示板 API バックエンドです。
`hono-bbs-merge` モノレポの一部（npm workspaces）。フロントエンドは [`packages/web`](../web) を参照。

- **Runtime**: Cloudflare Workers
- **Framework**: [Hono](https://hono.dev/)
- **DB**: Cloudflare D1 (SQLite 互換)
- **Session**: Cloudflare KV
- **Bot 対策**: Cloudflare Turnstile（本体に統合済み。旧 turnstileApiToken プラグインは廃止）
- **画像アップロード**: S3互換ストレージへの Presigned URL 発行（本体に統合済み。旧 imageUploader プラグインは廃止）
- **権限管理**: RBAC/ACL（`src/utils/acl.ts`）。owner・任意のロール/ユーザーへの明示的グラント・認証済み/匿名フォールバックで構成する

API 仕様の詳細は [`docs/endpoints/`](./docs/endpoints/) を参照してください。
本番デプロイの手順・環境変数一覧は [`docs/deployment.md`](./docs/deployment.md) / [`docs/env-vars.md`](./docs/env-vars.md) にまとめてあります。

---

## 目次

1. [ローカル開発手順](#ローカル開発手順)
2. [管理者初期設定](#管理者初期設定)

---

## ローカル開発手順

### 1. リポジトリのセットアップ

```bash
git clone <this-repo>
cd hono-bbs-merge
npm install          # ルートで実行 (npm workspaces、api/web 両方の依存関係が入る)
cd packages/api
```

### 2. 設定ファイルのコピー

実際の設定ファイルは `.gitignore` で除外されています。
`*.example.*` ファイルをコピーして使用してください。

```bash
# Wrangler 設定
cp wrangler.example.jsonc wrangler.jsonc

# ローカル開発用環境変数
cp .dev.vars.example .dev.vars
```

### 3. `wrangler.jsonc` の編集

本番デプロイ用に D1 と KV の ID を設定します (ローカル開発のみなら不要)。

```jsonc
"kv_namespaces": [{ "binding": "SESSION_KV", "id": "<KV_NAMESPACE_ID>" }],
"d1_databases": [{ "binding": "DB", "database_name": "hono-bbs-db", "database_id": "<D1_DATABASE_ID>" }]
```

### 4. `.dev.vars` の編集

```ini
API_BASE_PATH=/api/v1
ADMIN_INITIAL_PASSWORD=your-local-password
# ENABLE_TURNSTILE は設定しない (ローカル開発時は Turnstile スキップ)
```

### 5. ローカル D1 の初期化

```bash
npx wrangler d1 execute hono-bbs-db --local --file=schema/init.sql
```

### 6. 開発サーバー起動

```bash
npm run dev
```

### 7. admin パスワードの初期設定

```bash
curl -X POST http://localhost:8787/api/v1/auth/setup \
  -H "Content-Type: application/json" \
  -d '{"password":"your-local-password"}'
```

### 8. 動作確認

```bash
# ログイン
curl -X POST http://localhost:8787/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"id":"admin","password":"your-local-password"}'

# 板一覧
curl http://localhost:8787/api/v1/boards
```

> **補足**: ローカルの D1 データは `.wrangler/state/v3/d1/`、KV データは `.wrangler/state/v3/kv/` に保存されます。

---

## 管理者初期設定

デプロイ後の初期設定手順です。詳細は [`docs/admin-operations.md`](./docs/admin-operations.md) を参照してください。

```bash
# 1. admin でログイン
curl -X POST <API_BASE>/auth/login \
  -H "Content-Type: application/json" \
  -d '{"id":"admin","password":"<ADMIN_INITIAL_PASSWORD>"}'

# 2. Turnstile セッションを取得 (ENABLE_TURNSTILE=true の場合)
# GET <API_BASE>/auth/turnstile でページを開き、チャレンジを通過してセッションIDを取得
# ENABLE_TURNSTILE を設定していない開発環境では X-Turnstile-Session は不要

# 3. 板を作成 (acl は owner/grants/authenticatedActions/anonymousActions で構成する RBAC)
curl -X POST <API_BASE>/boards \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <SESSION_ID>" \
  -H "X-Turnstile-Session: <TURNSTILE_SESSION_ID>" \
  -d '{
    "id":"general","name":"雑談","defaultIdFormat":"daily_hash","defaultPosterName":"名無しさん",
    "maxThreads":1000,"defaultMaxPosts":500,
    "acl":{"grants":[],"authenticatedActions":["read","create","update","delete"],"anonymousActions":["read","create"]},
    "defaultThreadAcl":{"grants":[],"authenticatedActions":["read","create","update","delete"],"anonymousActions":["read","create"]},
    "defaultPostAcl":{"grants":[],"authenticatedActions":["read","create","update","delete"],"anonymousActions":["read","create"]}
  }'
```

---

## 開発コマンド

```bash
npm install         # 依存関係インストール
npm run dev         # Wrangler 開発サーバー起動 (http://localhost:8787)
npm run deploy      # 本番デプロイ
npm run cf-typegen  # Cloudflare bindings 型生成
```

本番デプロイ（初回のリソース作成〜更新デプロイ）の詳細は [`docs/deployment.md`](./docs/deployment.md) を参照してください。

---

## ライセンス

Apache-2.0
