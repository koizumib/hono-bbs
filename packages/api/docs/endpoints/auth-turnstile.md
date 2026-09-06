# エンドポイント: `GET/POST /auth/turnstile`

Cloudflare Turnstile チャレンジページの表示 (`GET`) とトークン検証・セッション発行 (`POST`)。
以前は `turnstileApiToken` という別 Worker として分離されていたが、コードレベルの結合が無く
（本体と KV を共有するだけ）、別ドメイン運用の制約もあったため、モノレポ統合時に本体へ統合した。

## GET /auth/turnstile

Turnstile ウィジェットを埋め込んだ HTML ページを返す。
`?returnTo=<url>` または `Referer` ヘッダーが `ALLOW_BBS_UI_DOMAINS` に含まれる場合、
チャレンジ完了後に `<returnTo>?setTurnstileToken=<sessionId>` へリダイレクトする。

## POST /auth/turnstile

```json
{ "token": "<turnstile-response-token>" }
```

成功レスポンス:
```json
{ "data": { "sessionId": "<uuid>", "alreadyIssued": false } }
```

同一 IP+User-Agent+当日中の再発行はデデュープされ `alreadyIssued: true` を返す（KV再書き込み無し）。
発行された `sessionId` は `X-Turnstile-Session` ヘッダーとして書き込み系エンドポイントに使用する。

`DISABLE_TURNSTILE=true` のとき、固定値 `dev-turnstile-disabled` を検証なしで返す（ローカル開発用）。

## 関連する環境変数

`TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_SESSION_PEPPER`, `TURNSTILE_TOKEN_TTL`,
`ALLOW_BBS_UI_DOMAINS`, `DISABLE_TURNSTILE` は本体の `wrangler.jsonc`/secret にそのまま設定する
（詳細は [`docs/env-vars.md`](../env-vars.md)）。この POST エンドポイントへの書き込みレート制限は
現状かけていない点に注意。
