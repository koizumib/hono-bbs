# デプロイ手順

## 概要

packages/admin は静的ファイルとしてビルドし、Cloudflare Pages にデプロイする。
バックエンド (packages/api) とは別オリジンで運用する (認証は同じセッション/ロール機構を共有するが、
デプロイは独立)。

認証方法 (`wrangler login` / APIトークン) は
[`packages/api/docs/deployment.md`](../../api/docs/deployment.md#cloudflareへの認証方法) と共通。

---

## ローカル開発

```bash
cp .env.example .env.local
# .env.local の VITE_API_BASE_URL を、動作させたい packages/api の URL に合わせる
npm run dev
# → http://localhost:5173 (packages/web と同時に動かす場合はポートが自動でずれる)
```

管理画面を使うには `user-admin-role` または `admin-role` に所属するアカウントでログインする
(初期状態では `admin` ユーザーのみ)。

---

## 本番デプロイ

### 1. Pagesプロジェクトの作成 (初回のみ)

```bash
npx wrangler pages project create hono-bbs-admin --production-branch=main
```

### 2. 本番用APIのURLを設定

```bash
cp .env.production.example .env.production
# VITE_API_BASE_URL / VITE_TURNSTILE_TOKEN_URL を packages/api のデプロイ先URLに合わせて編集する
```

### 3. ビルド + デプロイ

```bash
npm run deploy
# 内部で `npm run build && wrangler pages deploy dist --project-name=hono-bbs-admin` を実行する
```

2回目以降の更新デプロイは `npm run deploy` のみでよい。

### 4. バックエンド側の設定 (Turnstile使用時)

`ENABLE_TURNSTILE=true` で運用している場合、`packages/api` の `wrangler.jsonc` の
`vars.ALLOW_BBS_UI_DOMAINS` に、adminのデプロイ先URLを追加する (カンマ区切りで複数指定可)。
これが無いと `GET /auth/turnstile` 完了後、admin側へリダイレクトされない。

```jsonc
"vars": {
  "ALLOW_BBS_UI_DOMAINS": "https://your-web.pages.dev,https://your-admin.pages.dev"
}
```

---

## デプロイ後の動作確認チェックリスト

- [ ] `/login` でadmin(または user-admin-role所属アカウント)でログインできる
- [ ] 板一覧・作成・編集(ACLエディタ含む)・削除ができる
- [ ] スレッド一覧・削除ができる
- [ ] 投稿一覧・ACL編集・削除(ソフトデリート)ができる
- [ ] ユーザー一覧・編集・削除ができる
- [ ] ロール一覧・作成・編集・削除・メンバー追加/削除ができる
- [ ] ログアウトができる
