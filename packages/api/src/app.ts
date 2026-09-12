import { Hono } from 'hono'
import type { Context } from 'hono'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { trimTrailingSlash } from 'hono/trailing-slash'
import type { AppEnv } from './types'
import { authContext } from './middleware/auth'
import { setupAdapters } from './middleware/adapters'
import { domainRestrict } from './middleware/domain'
import { requestSizeLimit } from './middleware/requestSize'
import { blockBannedIp } from './middleware/ipBan'
import auth from './routes/auth'
import identity from './routes/identity'
import profile from './routes/profile'
import boards from './routes/boards'
import images from './routes/images'
import moderation from './routes/moderation'
import popularThreads from './routes/popularThreads'

// 内部ルーター (ベースパスなし)。
// boards 以下はチェーンでマウントし、hc<AppType>() のRPC型推論にスキーマが伝播するようにする
// (AppType自体は rpcType.ts で別途エクスポートする。このファイルをそのままpackages/webにimportさせると
// auth/identity/profile/imagesの実装まで型チェック対象に引き込まれてしまうため、あえて分離している)。
export const api = new Hono<AppEnv>()
  .use(trimTrailingSlash())
  // CORS (プリフライト・Vary: Origin 等は hono/cors に任せる)
  // CORS_ORIGIN 未設定時は * (全許可) にフォールバック
  .use('*', cors({
    origin: (origin, c: Context<AppEnv>) => {
      const allowed = (c.env.CORS_ORIGIN ?? '').split(',').map((s) => s.trim()).filter(Boolean)
      if (allowed.length === 0) return '*'
      return allowed.includes(origin) ? origin : undefined
    },
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Turnstile-Session'],
    maxAge: 86400,
  }))
  // ドメイン制限 (BBS_ALLOW_DOMAIN が設定されている場合のみ有効)
  .use('*', domainRestrict)
  // リクエストサイズ制限 (MAX_REQUEST_SIZE が設定されている場合のみ有効)
  .use('*', requestSizeLimit)
  // アダプターセットアップ (DB / KV をコンテキストにセット)
  .use('*', setupAdapters)
  // IPBAN (書き込み系のみブロック。閲覧(GET)は許可する)
  .use('*', blockBannedIp)
  // 全ルートに認証コンテキストを適用
  .use('*', authContext)
  .route('/boards', boards)

// hc() 経由で呼ばないルートはチェーンの外でマウントする
api.route('/auth', auth)
api.route('/identity', identity)
api.route('/profile', profile)
// 旧 imageUploader プラグイン: /upload/* と /images/* を直下にマウント
api.route('/', images)
// IPBAN・通報キュー管理 (isSysAdmin のみ)
api.route('/moderation', moderation)
// トップページ向け、全板横断の人気スレッド (Cronが更新するKVキャッシュを返すだけ)
api.route('/popular-threads', popularThreads)

// グローバルエラーハンドラー
api.onError((err, c) => {
  // zValidator('json', ...) やHono自身が投げる HTTPException (例: 不正なJSONボディを
  // c.req.json()相当の内部処理でパースした際の400) は、自身のstatusを保持している。
  // それを無視して一律500にしてしまうと、クライアント起因のエラーが内部エラーとして
  // 扱われてしまう (かつ本来の400という有用な情報が失われる)
  if (err instanceof HTTPException && err.status < 500) {
    return c.json({ error: 'VALIDATION_ERROR', message: err.message || 'Invalid request' }, err.status)
  }
  // c.req.json() を直接呼んで自前でtry/catchしていない箇所が投げる素の SyntaxError も同様に400にする
  if (err instanceof SyntaxError) {
    return c.json({ error: 'VALIDATION_ERROR', message: 'Invalid JSON body' }, 400)
  }
  console.error(err)
  return c.json({ error: 'INTERNAL_SERVER_ERROR', message: 'An error occurred' }, 500)
})
