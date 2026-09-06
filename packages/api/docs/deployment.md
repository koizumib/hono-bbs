# セットアップ・デプロイガイド

hono-bbs 本体 (`packages/api`) の開発環境構築・本番デプロイ手順です。
リソース作成からデプロイまで、すべて `wrangler` CLI コマンドを直接実行します（専用スクリプトは用意していません）。

環境変数の一覧・`vars`/`secret` の区別は [`docs/env-vars.md`](./env-vars.md) を参照してください。

---

## 目次

- [前提条件](#前提条件)
- [Cloudflareへの認証方法](#cloudflareへの認証方法)
- [ローカル開発環境](#ローカル開発環境)
- [本番デプロイ（初回: リソース作成）](#本番デプロイ初回リソース作成)
- [更新デプロイ（2回目以降）](#更新デプロイ2回目以降)
- [D1 の操作](#d1-の操作)
- [型生成](#型生成)
- [トラブルシューティング](#トラブルシューティング)
- [代替デプロイ先 (Node.js / Docker)](#代替デプロイ先-nodejs--docker)

---

## 前提条件

- Node.js 18 以上
- npm
- Cloudflareアカウント

`wrangler` CLI は `npm install` でこのリポジトリのdevDependencyとして入るため、別途インストール不要です（`npx wrangler ...` で実行する）。

---

## Cloudflareへの認証方法

以下のどちらか一方でよい。

### A. `wrangler login`（個人の手元での作業向け）

```bash
npx wrangler login
```

ブラウザが開き、自分のCloudflareアカウントでログインする。以後 `npx wrangler whoami` で確認できる。
自分のアカウント権限をそのまま使うので、個人の開発機での作業に向く。

### B. APIトークン（自動化・複数人での共有運用向け）

1. https://dash.cloudflare.com/profile/api-tokens で「カスタムトークンを作成」し、以下の権限を付与する:
   - Account > Workers Scripts > Edit
   - Account > Workers KV Storage > Edit
   - Account > D1 > Edit
   - Account > Cloudflare Pages > Edit （`packages/web` もデプロイする場合）
2. リポジトリルートに `.cloudflare.env`（`.cloudflare.env.example` をコピー）を作成し、値を埋める。
   Account IDはトークンさえあれば `npx wrangler whoami` の出力からも確認できる。
   ```bash
   cp .cloudflare.env.example .cloudflare.env
   chmod 600 .cloudflare.env
   ```
3. コマンドを実行する前に毎回 `source` する:
   ```bash
   source .cloudflare.env
   npx wrangler whoami   # 認証できていることを確認
   ```

`.cloudflare.env` は `.gitignore` 済みでコミットされない。以降の手順で `npx wrangler ...` を実行する前に、必ずどちらかの方法で認証済みであることを確認すること。

---

## ローカル開発環境

### 1. 依存関係のインストール

```bash
npm install          # リポジトリルートで実行 (npm workspaces)
cd packages/api
```

### 2. 設定ファイルのコピー

```bash
cp wrangler.example.jsonc wrangler.jsonc
cp .dev.vars.example .dev.vars
```

### 3. `.dev.vars` の編集

```ini
API_BASE_PATH=/api/v1
ADMIN_INITIAL_PASSWORD=your-local-password
CORS_ORIGIN=http://localhost:5173
# ENABLE_TURNSTILE は設定しない (ローカル開発時は Turnstile スキップ)
```

### 4. ローカルD1の初期化

```bash
npx wrangler d1 execute hono-bbs-db --local --file=schema/init.sql
```

`wrangler.jsonc` の `database_id` を本番用に設定していなくても、`--local` 実行はwranglerが自動でローカルSQLiteファイルを管理するため問題ない。

### 5. 開発サーバー起動

```bash
npm run dev
# → http://localhost:8787
```

### 6. admin初期設定・動作確認

```bash
curl -X POST http://localhost:8787/api/v1/auth/setup \
  -H "Content-Type: application/json" \
  -d '{"password":"your-local-password"}'

curl -X POST http://localhost:8787/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"id":"admin","password":"your-local-password"}'

curl http://localhost:8787/api/v1/boards
```

> ローカルのD1データは `.wrangler/state/v3/d1/`、KVデータは `.wrangler/state/v3/kv/` に保存される。

---

## 本番デプロイ（初回: リソース作成）

新しいCloudflareアカウント/環境に初めてデプロイするときの手順。[認証方法](#cloudflareへの認証方法)のどちらかを済ませてから進める。

### 1. `wrangler.jsonc` の準備

```bash
cp wrangler.example.jsonc wrangler.jsonc
```

### 2. D1データベースの作成

```bash
npx wrangler d1 create hono-bbs-db
```

出力される `database_id` を `wrangler.jsonc` の `d1_databases[0].database_id` に貼り付ける。

> 既に同名のデータベースが存在する場合、`A database with that name already exists` エラーになる。
> その場合は `npx wrangler d1 list` で既存の `uuid` を確認して使う。

### 3. KV Namespaceの作成

```bash
npx wrangler kv namespace create SESSION_KV
```

出力される `id` を `wrangler.jsonc` の `kv_namespaces[0].id` に貼り付ける。
同様に既に存在する場合は `npx wrangler kv namespace list` で確認する。

### 4. 非機密設定 (`vars`) の記入

`wrangler.jsonc` の `vars` に、必要な項目を追記する（一覧は [`docs/env-vars.md`](./env-vars.md)）。最低限、フロントエンドのオリジンを許可するために以下を設定することが多い:

```jsonc
"vars": {
  "API_BASE_PATH": "/api/v1",
  "USER_DISPLAY_LIMIT": "0",
  "ROLE_DISPLAY_LIMIT": "0",
  "CORS_ORIGIN": "https://your-frontend.pages.dev"
}
```

### 5. 機密情報 (secrets) の設定

```bash
npx wrangler secret put ADMIN_INITIAL_PASSWORD
```

`vars` と違い、値はプロンプトから入力する（コマンド履歴やファイルに残らない）。Turnstile/画像アップロード機能を使う場合は必要に応じて追加する:

```bash
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put TURNSTILE_SESSION_PEPPER
npx wrangler secret put S3_ACCESS_KEY_ID
npx wrangler secret put S3_SECRET_ACCESS_KEY
npx wrangler secret put ADMIN_API_KEY
```

### 6. 本番D1の初期化

```bash
npx wrangler d1 execute hono-bbs-db --remote --file=schema/init.sql
```

> **警告**: `schema/init.sql` は全テーブルをDROPして再作成する。**初回のみ**実行すること。
> 既にデータが入った本番DBに対して実行すると、全データが失われる。

### 7. デプロイ

```bash
npm run deploy
```

出力される `https://<worker-name>.<subdomain>.workers.dev` がAPIのURL。

### 8. admin初期設定（一度だけ実行可能）

```bash
curl -X POST https://<worker-name>.<subdomain>.workers.dev/api/v1/auth/setup \
  -H "Content-Type: application/json" \
  -d '{"password":"<ADMIN_INITIAL_PASSWORDに設定した値>"}'
```

成功レスポンス: `{"data":{"message":"Admin password has been set"}}`
2回目の実行は `409 ALREADY_SETUP` になる。

設定が終わったら、シークレットを削除しておく（再利用しないため）:

```bash
npx wrangler secret delete ADMIN_INITIAL_PASSWORD
```

### 初回セットアップ チェックリスト

- [ ] `wrangler.jsonc` を作成した
- [ ] `wrangler.jsonc` に D1 の `database_id` を設定した
- [ ] `wrangler.jsonc` に KV の `id` を設定した
- [ ] `CORS_ORIGIN` など必要な `vars` を設定した
- [ ] `ADMIN_INITIAL_PASSWORD` をsecretとして登録した
- [ ] `npx wrangler d1 execute hono-bbs-db --remote --file=schema/init.sql` を実行した
- [ ] `npm run deploy` を実行した
- [ ] `POST /auth/setup` を実行してadminパスワードを設定した
- [ ] adminでログインできることを確認した

---

## 更新デプロイ（2回目以降）

コードを変更して再デプロイするだけなら、リソース作成は不要。以下のみでよい:

```bash
npm run deploy
```

`wrangler.jsonc` の `vars` を追記・変更した場合も同じコマンドで反映される（再デプロイのたびに読み込まれる）。
DBスキーマを変更した場合は、[D1 の操作](#d1-の操作)を参照して個別に反映すること（`init.sql` の再実行は既存データを消すため使わない）。

---

## D1 の操作

```bash
# 内容確認 (本番)
npx wrangler d1 execute hono-bbs-db --remote --command "SELECT * FROM users;"

# 内容確認 (ローカル)
npx wrangler d1 execute hono-bbs-db --local --command "SELECT * FROM users;"

# バックアップ
npx wrangler d1 export hono-bbs-db --remote --output=backup-$(date +%Y%m%d).sql

# スキーマの全リセット（破壊的・既存データが全て消える。初回セットアップ以外では使わない）
npx wrangler d1 execute hono-bbs-db --remote --file=schema/init.sql
```

---

## 型生成

`wrangler.jsonc` を変更した後（binding追加など）は型定義を再生成する:

```bash
npm run cf-typegen
```

---

## トラブルシューティング

### `POST /auth/setup` が `ALREADY_SETUP` を返す

既にadminパスワードが設定済み。ログインして操作する。

### CORSエラーが出る

`wrangler.jsonc` の `vars.CORS_ORIGIN` にフロントエンドのオリジンが含まれているか確認する。

### D1に接続できない

`wrangler.jsonc` の `database_id` が正しいか確認する。ローカルなら `--local`、本番なら `--remote` を付けて実行しているか確認する。

### Cloudflare Pagesプロジェクトの作成が失敗する

同名のプロジェクトが既に存在する、または過去に作った同名プロジェクトにカスタムドメインが紐づいたまま残っている場合に失敗することがある。`npx wrangler pages project list` で既存プロジェクトを確認する。

### 型エラーが出る

```bash
npm run cf-typegen
```

---

## 代替デプロイ先 (Node.js / Docker)

Cloudflare Workers以外にデプロイしたい場合、`src/index.node.ts` というNode.js/Bun向けの代替エントリポイントが用意されている。ただし以下のオプション依存を別途インストールする必要があり、`tsconfig.json` のデフォルト設定（`@cloudflare/workers-types` のみ）ではこのファイル単体を `tsc --noEmit` すると型エラーになるのが既知の状態（バグではない）。

```bash
npm install better-sqlite3   # SQLite (デフォルト)
npm install mysql2           # MySQL 使用時
npm install pg               # PostgreSQL 使用時
npm install ioredis          # Redis (KVの代替) 使用時
npm install @hono/node-server @types/node
```

`schema/init.mysql.sql` / `init.postgresql.sql` は古い所有者/グループ権限モデルを前提としており、現行のACLモデルとは一致しない（[`CLAUDE.md`](../../../CLAUDE.md)参照）。これらを使う場合は最新のACLスキーマへの追従が別途必要になる。日常的な運用経路ではないため、詳細な手順（systemd/Docker設定例）はこのドキュメントでは割愛する。
