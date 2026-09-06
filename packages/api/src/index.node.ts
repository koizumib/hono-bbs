// Node.js / Bun 向けエントリポイント
// Cloudflare Workers 以外の環境 (Linux サーバー等) で実行する場合にこちらを使用する
//
// 使用方法:
//   npm install @hono/node-server
//   DB_DRIVER=sqlite DATABASE_URL=./local.db node dist/index.node.js
//
// 必要な追加パッケージ (使用するドライバーに応じてインストール):
//   SQLite:      npm install better-sqlite3
//   MySQL:       npm install mysql2
//   PostgreSQL:  npm install pg
//   Redis:       npm install ioredis
//   S3/MinIO:    npm install @aws-sdk/client-s3

import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import type { Context } from 'hono'
import { cors } from 'hono/cors'
import { trimTrailingSlash } from 'hono/trailing-slash'
import type { AppEnv } from './types'
import { authContext } from './middleware/auth'
import { domainRestrict } from './middleware/domain'
import { requestSizeLimit } from './middleware/requestSize'
import auth from './routes/auth'
import identity from './routes/identity'
import profile from './routes/profile'
import boards from './routes/boards'
import { createDbAdapterFromEnv } from './adapters/db.node'
import { createKvAdapterFromEnv } from './adapters/kv.node'
import type { DbAdapter } from './adapters/db'
import type { KvAdapter } from './adapters/kv'

async function main() {
  // アダプターをプロセス起動時に一度だけ生成する
  const db: DbAdapter = await createDbAdapterFromEnv()
  const kv: KvAdapter = await createKvAdapterFromEnv()

  console.log(`[hono-bbs] DB driver: ${process.env.DB_DRIVER ?? 'sqlite'}`)
  console.log(`[hono-bbs] KV driver: ${process.env.KV_DRIVER ?? 'memory'}`)

  const api = new Hono<AppEnv>()

  api.use(trimTrailingSlash())
  api.use('*', cors({
    origin: (origin, c: Context<AppEnv>) => {
      const allowed = (c.env.CORS_ORIGIN ?? '').split(',').map((s) => s.trim()).filter(Boolean)
      if (allowed.length === 0) return '*'
      return allowed.includes(origin) ? origin : undefined
    },
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Turnstile-Session'],
    maxAge: 86400,
  }))
  api.use('*', domainRestrict)
  api.use('*', requestSizeLimit)

  // Node.js 環境: 起動時に生成したアダプターをコンテキストに注入する
  // (Cloudflare Workers の setupAdapters ミドルウェアの代わり)
  api.use('*', async (c, next) => {
    c.set('db', db)
    c.set('kv', kv)
    await next()
  })

  api.use('*', authContext)

  api.route('/auth', auth)
  api.route('/identity', identity)
  api.route('/profile', profile)
  api.route('/boards', boards)

  api.onError((err, c) => {
    console.error(err)
    return c.json({ error: 'INTERNAL_SERVER_ERROR', message: 'An error occurred' }, 500)
  })

  const port = Number(process.env.PORT ?? 3000)
  const basePath = process.env.API_BASE_PATH ?? '/api/v1'
  const corsOrigin = process.env.CORS_ORIGIN

  serve({
    fetch: async (request: Request) => {
      const url = new URL(request.url)

      if (!url.pathname.startsWith(basePath)) {
        return Response.json({ error: 'NOT_FOUND', message: `API base path is ${basePath}` }, { status: 404 })
      }

      const newPath = url.pathname.slice(basePath.length) || '/'
      url.pathname = newPath

      // Node.js 環境では env は process.env から読み取る
      const env: AppEnv['Bindings'] = {
        API_BASE_PATH:          basePath,
        ENABLE_TURNSTILE:       process.env.ENABLE_TURNSTILE,
        ADMIN_INITIAL_PASSWORD: process.env.ADMIN_INITIAL_PASSWORD,
        ADMIN_USERNAME:         process.env.ADMIN_USERNAME,
        USER_ADMIN_ROLE:        process.env.USER_ADMIN_ROLE,
        MAX_REQUEST_SIZE:       process.env.MAX_REQUEST_SIZE,
        CORS_ORIGIN:            corsOrigin,
        BBS_ALLOW_DOMAIN:       process.env.BBS_ALLOW_DOMAIN,
        USER_DISPLAY_LIMIT:     process.env.USER_DISPLAY_LIMIT,
        ROLE_DISPLAY_LIMIT:     process.env.ROLE_DISPLAY_LIMIT,
        KV_PREFIX:              process.env.KV_PREFIX,
        TURNSTILE_SITE_KEY:       process.env.TURNSTILE_SITE_KEY,
        TURNSTILE_SECRET_KEY:     process.env.TURNSTILE_SECRET_KEY,
        TURNSTILE_SESSION_PEPPER: process.env.TURNSTILE_SESSION_PEPPER,
        TURNSTILE_TOKEN_TTL:      process.env.TURNSTILE_TOKEN_TTL,
        ALLOW_BBS_UI_DOMAINS:     process.env.ALLOW_BBS_UI_DOMAINS,
        // 画像アップロード機能 (/upload, /images) は D1/R2 依存のため Node.js ローカル環境では未マウント
      }

      return api.fetch(new Request(url.toString(), request), env)
    },
    port,
  })

  console.log(`[hono-bbs] Server running on http://localhost:${port}${basePath}`)
}

main().catch(err => {
  console.error('[hono-bbs] Fatal error:', err)
  process.exit(1)
})
