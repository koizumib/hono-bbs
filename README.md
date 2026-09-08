# hono-bbs

匿名掲示板。npm workspaces によるモノレポ。

- [`packages/api`](./packages/api) — Cloudflare Workers + Hono + D1 + KV のバックエンド API
- [`packages/web`](./packages/web) — React + Vite のフロントエンド (AnonBoard)
- [`packages/admin`](./packages/admin) — React + Vite の管理画面 (板/スレッド/投稿/ユーザー/ロール管理)

権限管理はRBAC/ACL（`packages/api/src/utils/acl.ts`）。詳細は各パッケージの README を参照。

`hono-bbs-admin`（別リポジトリ、FastAPI製の旧管理画面）は現行APIと非互換になったため、
`packages/admin` に置き換えた。ローカルのクローンは削除済み（GitHub上のリポジトリ自体は
参照用に残っている）。

## セットアップ

```bash
npm install                  # ルートで実行 (workspaces、api/web/admin全ての依存関係が入る)
cd packages/api && npm run dev      # バックエンド (http://localhost:8787)
cd packages/web && npm run dev      # フロントエンド (http://localhost:5173)
cd packages/admin && npm run dev    # 管理画面 (http://localhost:5173、web と同時起動時はポートがずれる)
```

ローカル開発の詳細手順は各パッケージのREADME（[`packages/api`](./packages/api#ローカル開発手順) /
[`packages/web`](./packages/web#開発環境のセットアップ) /
[`packages/admin`](./packages/admin#開発環境のセットアップ)）を参照してください。

## Cloudflareへのデプロイ

- [`packages/api/docs/deployment.md`](./packages/api/docs/deployment.md) — バックエンド (Cloudflare Workers + D1 + KV) の初回セットアップ・更新デプロイ手順
- [`packages/web/docs/deployment.md`](./packages/web/docs/deployment.md) — フロントエンド (Cloudflare Pages) のデプロイ手順
- [`packages/admin/docs/deployment.md`](./packages/admin/docs/deployment.md) — 管理画面 (Cloudflare Pages) のデプロイ手順

いずれも `wrangler` CLIコマンドを直接実行する運用で、専用の自動化スクリプトは用意していません。

## ライセンス

Apache-2.0
