import { api } from './app'
import type { AppEnv } from './types'
import { runCleanup } from './features/imageUpload/cleanup'

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

  // Cron Trigger で画像の自動削除を実行する (旧 imageUploader プラグイン)
  // wrangler.jsonc の triggers.crons でスケジュールを設定すること
  async scheduled(_event: ScheduledEvent, env: AppEnv['Bindings'], ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      runCleanup(env).then(({ deleted, errors }) => {
        console.log(`[Cleanup] deleted: ${deleted}, errors: ${errors}`)
      }),
    )
  },
}
