# デプロイ手順

## 概要

bbs-ui は静的ファイルとしてビルドし、任意の静的ホスティングサービスにデプロイできます。バックエンドの hono-bbs と同一オリジンまたは CORS 許可済みのオリジンに配置します。

---

## ビルド

```bash
# 依存パッケージのインストール
npm install

# プロダクションビルド
npm run build
```

ビルド成果物は `dist/` ディレクトリに出力されます。

---

## 環境変数

デプロイ先のCI/CD環境またはホスティングサービスの環境変数設定に以下を登録してください。

| 変数名 | 必須 | 説明 |
|---|---|---|
| `VITE_API_BASE_URL` | ✅ | バックエンドAPIのベースURL（例: `https://api.example.com`） |
| `VITE_API_BASE_PATH` | — | APIのベースパス。デフォルト `/api/v1` |
| `VITE_TURNSTILE_SITE_KEY` | ✅ | Cloudflare Turnstile のサイトキー |
| `VITE_DISABLE_TURNSTILE` | — | `true` にするとTurnstile検証をスキップ。**本番では設定しない** |

> **注意:** Vite の環境変数はビルド時に静的に埋め込まれます。環境変数を変更した場合は再ビルドが必要です。

---

## Cloudflare Turnstile の設定

バックエンド（hono-bbs）の環境変数 `ALLOW_BBS_UI_DOMAINS` にフロントエンドのドメインを追加します。

```
ALLOW_BBS_UI_DOMAINS=https://bbs.example.com
```

これにより、Turnstile チャレンジ完了後にフロントエンドへ `?setTurnstileToken=<sessionId>` 付きでリダイレクトされます。

---

## SPAのルーティング設定

React Router を使用しているため、すべてのパスで `index.html` を返すようにサーバーを設定する必要があります。

### Cloudflare Pages

`public/_redirects` ファイルを作成（または `dist/_redirects` として配置）：

```
/* /index.html 200
```

### Nginx

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

### Apache

`.htaccess` ファイルをドキュメントルートに配置：

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

---

## Cloudflare Pages へのデプロイ（推奨）

hono-bbs が Cloudflare Workers にデプロイされている場合、同じ Cloudflare エコシステムで管理できます。

### GitHub 連携による自動デプロイ

1. Cloudflare Pages ダッシュボードで新しいプロジェクトを作成
2. GitHub リポジトリを連携
3. ビルド設定：
   - **Framework preset**: Vite
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. 環境変数をダッシュボードで設定

### `_redirects` の配置

`public/` ディレクトリに `_redirects` ファイルを作成：

```
/* /index.html 200
```

---

## Docker を使ったデプロイ

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_BASE_URL
ARG VITE_API_BASE_PATH=/api/v1
ARG VITE_TURNSTILE_SITE_KEY
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

`nginx.conf`:

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;
}
```

ビルド：

```bash
docker build \
  --build-arg VITE_API_BASE_URL=https://api.example.com \
  --build-arg VITE_TURNSTILE_SITE_KEY=your-site-key \
  -t bbs-ui .
```

---

## CORS 設定（バックエンド側）

hono-bbs の環境変数 `CORS_ORIGIN` にフロントエンドのオリジンを設定します。

```
CORS_ORIGIN=https://bbs.example.com
```

複数オリジンを許可する場合はカンマ区切り：

```
CORS_ORIGIN=https://bbs.example.com,https://staging.example.com
```

---

## デプロイ後の動作確認チェックリスト

- [ ] トップページ（`/`）が表示される
- [ ] 板の一覧が表示される（APIと疎通できている）
- [ ] スレッドをクリックして投稿一覧が表示される
- [ ] Turnstile チャレンジが表示・完了できる
- [ ] 書き込みフォームから投稿できる
- [ ] ブラウザでURLを直接入力してもページが表示される（SPAルーティング）
- [ ] `/settings` ページが表示される
