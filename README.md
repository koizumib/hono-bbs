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

## ライセンス

Apache-2.0
