# hono-bbs

匿名掲示板。npm workspaces によるモノレポ。

- [`packages/api`](./packages/api) — Cloudflare Workers + Hono + D1 + KV のバックエンド API
- [`packages/web`](./packages/web) — React + Vite のフロントエンド (AnonBoard)

`hono-bbs`（API）と `hono-bbs-ui`（フロント）を統合し、権限管理をビットマスク＋CSV文字列から
RBAC/ACL（`packages/api/src/utils/acl.ts`）に刷新した。旧 `turnstileApiToken`/`imageUploader`
プラグインは本体に統合、`twoCh`/`datImport` は廃止した。詳細は各パッケージの README を参照。

管理者用ダッシュボード（`hono-bbs-admin`）は別リポジトリで管理する。

## セットアップ

```bash
npm install                  # ルートで実行 (workspaces、api/web両方の依存関係が入る)
cd packages/api && npm run dev    # バックエンド (http://localhost:8787)
cd packages/web && npm run dev    # フロントエンド (http://localhost:5173)
```

ローカル開発の詳細手順は各パッケージのREADME（[`packages/api`](./packages/api#ローカル開発手順) / [`packages/web`](./packages/web#開発環境のセットアップ)）を参照してください。

## Cloudflareへのデプロイ

- [`packages/api/docs/deployment.md`](./packages/api/docs/deployment.md) — バックエンド (Cloudflare Workers + D1 + KV) の初回セットアップ・更新デプロイ手順
- [`packages/web/docs/deployment.md`](./packages/web/docs/deployment.md) — フロントエンド (Cloudflare Pages) のデプロイ手順

いずれも `wrangler` CLIコマンドを直接実行する運用で、専用の自動化スクリプトは用意していません。

## ライセンス

Apache-2.0
