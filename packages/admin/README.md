# hono-bbs 管理画面 (packages/admin)

`hono-bbs-merge` モノレポの一部（npm workspaces）。React 19 + Vite + TypeScript製の管理画面フロントエンド。
`packages/web`（公開掲示板側）とは独立したCloudflare Pagesプロジェクトとしてデプロイする。

- **対象**: 板・スレッド・投稿(モデレーション)・ユーザー・ロールの管理
- **認証**: `packages/api`の`user-admin-role`/`admin-role`メンバーでログイン (公開掲示板と同じセッション機構)
- **型安全性**: `hc<AdminAppType>()` (Hono RPC) で`packages/api`のレスポンス/リクエスト型をそのまま利用する。
  `packages/web`向けの`AppType`とは別に、`@hono-bbs/api/admin`から`AdminAppType`をimportする
  (board/thread/postに加えidentity/authも含む、web向けより広いスコープ)

サイト全体のブランディング設定(アプリ名等)は、`packages/api`に対応する概念が無いため、意図的に
このアプリのスコープ外としている(`packages/web`のビルド時env varで管理する)。

## 開発環境のセットアップ

```bash
npm install          # リポジトリルートで実行 (npm workspaces)
cd packages/admin
cp .env.example .env.local
npm run dev          # http://localhost:5173 (または空いているポート)
```

## 主要コマンド

```bash
npm run dev       # 開発サーバー起動
npm run build     # プロダクションビルド
npm run preview   # ビルド結果のプレビュー
npm run lint      # ESLint チェック
npm run deploy    # ビルド + Cloudflare Pages へデプロイ
```

デプロイ手順の詳細は [`docs/deployment.md`](./docs/deployment.md) を参照。

## プロジェクト構成

```
src/
├── config/       # 環境変数の型安全な読み取り
├── api/          # hc<AdminAppType>() ラッパー・型定義 (rpcClient.ts が中心)
├── stores/       # Zustand ストア (認証・Turnstile)
├── components/   # UIコンポーネント (AclEditor が中心)
└── pages/        # ページコンポーネント (react-router-dom)
```
