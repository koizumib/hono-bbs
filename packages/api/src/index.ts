import { api } from './app'
import type { AppEnv } from './types'
import { runCleanup } from './features/imageUpload/cleanup'
import { createD1Adapter } from './adapters/db'
import { createCloudflareKvAdapter, withKvPrefix } from './adapters/kv'
import { refreshPopularThreads } from './services/popularThreadsService'

// API_BASE_PATH を env から動的に読み取り、URLのプレフィックスを除去して内部ルーターに転送
export default {
  async fetch(request: Request, env: AppEnv['Bindings'], ctx: ExecutionContext): Promise<Response> {
    const basePath = env.API_BASE_PATH ?? '/api/v1'
    const url = new URL(request.url)

    if (!url.pathname.startsWith(basePath)) {
      return Response.json({ error: 'NOT_FOUND', message: `API base path is ${basePath}` }, { status: 404 })
    }

    // ベースパスを除去して内部ルーターに転送する (CORSヘッダーは内部ルーターのcorsミドルウェアが付与する)
    const newPath = url.pathname.slice(basePath.length) || '/'
    url.pathname = newPath
    return api.fetch(new Request(url.toString(), request), env, ctx)
  },

  // Cron Trigger (1時間毎、wrangler.jsonc の triggers.crons で設定) で
  // (1) 画像の自動削除 (旧 imageUploader プラグイン) と
  // (2) トップページ向け「全板横断の人気スレッド」の再集計・KVキャッシュ更新 を行う
  async scheduled(_event: ScheduledEvent, env: AppEnv['Bindings'], ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      runCleanup(env).then(({ deleted, errors }) => {
        console.log(`[Cleanup] deleted: ${deleted}, errors: ${errors}`)
      }),
    )
    if (env.DB && env.SESSION_KV) {
      const db = createD1Adapter(env.DB)
      const kv = withKvPrefix(createCloudflareKvAdapter(env.SESSION_KV), env.KV_PREFIX ?? '')
      ctx.waitUntil(
        refreshPopularThreads(db, kv).then((snapshot) => {
          console.log(`[PopularThreads] recomputed ${snapshot.items.length} items`)
        }),
      )
    }
  },
}
