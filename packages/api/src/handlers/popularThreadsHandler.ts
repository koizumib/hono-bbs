import type { Context } from 'hono'
import type { AppEnv } from '../types'
import { getPopularThreads } from '../services/popularThreadsService'

// GET /popular-threads - トップページ向け、全板横断の人気スレッド上位一覧。
// 通常はCronが1時間毎に更新したKVキャッシュを返すだけ(このリクエスト自体は再集計しない)。
export async function getPopularThreadsHandler(c: Context<AppEnv>): Promise<Response> {
  const snapshot = await getPopularThreads(c.get('db'), c.get('kv'))
  return c.json({ data: snapshot })
}
