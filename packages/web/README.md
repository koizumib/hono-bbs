# bbs-ui — AnonBoard フロントエンド

[hono-bbs](https://github.com/yumekui8/hono-bbs) バックエンドと組み合わせて動作する、匿名掲示板のフロントエンドアプリケーションです。

## 技術スタック

| カテゴリ | ライブラリ |
|---|---|
| フレームワーク | React 19 + TypeScript + Vite |
| スタイリング | Tailwind CSS v3 + @tailwindcss/forms |
| ルーティング | React Router v7 |
| 状態管理 | Zustand v5 |
| データフェッチ | TanStack Query v5 |
| フォーム | React Hook Form + Zod |
| 日付 | date-fns (ja locale) |
| Bot対策 | Cloudflare Turnstile (@marsidev/react-turnstile) |

## 開発環境のセットアップ

```bash
# 依存パッケージのインストール
npm install

# 環境変数の設定
cp .env.example .env.local
# .env.local を編集して VITE_API_BASE_URL 等を設定

# 開発サーバー起動
npm run dev
```

## 環境変数

| 変数名 | 説明 | デフォルト |
|---|---|---|
| `VITE_API_BASE_URL` | バックエンドAPIのベースURL | `http://localhost:8787` |
| `VITE_API_BASE_PATH` | APIのベースパス | `/api/v1` |
| `VITE_TURNSTILE_SITE_KEY` | Cloudflare Turnstile のサイトキー | — |
| `VITE_DISABLE_TURNSTILE` | `true` でTurnstile検証をスキップ（開発用） | `false` |

開発環境では `VITE_DISABLE_TURNSTILE=true` を設定し、バックエンド側でも `DISABLE_TURNSTILE=true` にするとBot対策チェックをスキップできます。

## 主要コマンド

```bash
npm run dev       # 開発サーバー起動 (http://localhost:5173)
npm run build     # プロダクションビルド
npm run preview   # ビルド結果のプレビュー
npm run lint      # ESLint チェック
```

## プロジェクト構成

```
src/
├── config/       # 環境変数の型安全な読み取り
├── api/          # APIクライアント層（fetch ラッパー・型定義）
├── stores/       # Zustand ストア（認証・Turnstile・設定）
├── hooks/        # TanStack Query カスタムフック
├── components/   # UIコンポーネント
│   ├── ui/       # 汎用プリミティブ
│   ├── layout/   # レイアウト（サイドバー・スレッド一覧パネル）
│   ├── thread/   # スレッドカード
│   ├── post/     # 投稿・ミニマップ・書き込みフォーム
│   └── auth/     # ログインモーダル
├── pages/        # ページコンポーネント
└── utils/        # ユーティリティ（権限・NGフィルタ・URL抽出・日付）
```

## ドキュメント

- [アプリケーション仕様](docs/specification.md)
- [デプロイ手順](docs/deployment.md)
- [API仕様](docs/api/README.md)
