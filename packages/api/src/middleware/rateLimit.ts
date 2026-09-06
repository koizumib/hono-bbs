import type { Context, MiddlewareHandler } from 'hono'
import type { AppEnv } from '../types'
import type { KvAdapter } from '../adapters/kv'

function parseLimit(s: string | undefined): number {
  return Math.max(0, parseInt(s ?? '0', 10) || 0)
}

function parseWindowMs(s: string | undefined): number {
  const minutes = Math.max(1, parseInt(s ?? '60', 10) || 60)
  return minutes * 60 * 1000
}

// Sliding Window Log方式でカウントし、許可されれば記録する。
// limit=0 または kv 未設定のときは常に許可 (無制限)。
// 各機能(ログイン失敗・画像アップロード・スレッド/投稿作成・Turnstile発行)で
// バラバラに実装されていたレート制限ロジックの共通部分をここに集約する。
export async function checkAndRecord(
  kv: KvAdapter | undefined,
  keyPrefix: string,
  identifier: string,
  limitStr: string | undefined,
  windowStr: string | undefined,
): Promise<boolean> {
  const limit = parseLimit(limitStr)
  if (limit === 0 || !kv) return true

  const windowMs = parseWindowMs(windowStr)
  const now = Date.now()
  const windowStart = now - windowMs
  const key = `${keyPrefix}:${identifier}`

  const all = (await kv.get<number[]>(key, 'json')) ?? []
  const recent = all.filter((t) => t > windowStart)
  if (recent.length >= limit) return false

  recent.push(now)
  await kv.put(key, JSON.stringify(recent), { expirationTtl: Math.ceil(windowMs / 1000) })
  return true
}

// ルートに直接適用するHonoミドルウェア。c.get('kv') (SESSION_KV) を使う標準的なケース向け。
// 上限を超えていたら 429 RATE_LIMIT_EXCEEDED を返す。
export function rateLimit(opts: {
  keyPrefix: string
  keyFn: (c: Context<AppEnv>) => string
  limitEnvKey: keyof AppEnv['Bindings']
  windowEnvKey: keyof AppEnv['Bindings']
}): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const allowed = await checkAndRecord(
      c.get('kv'),
      opts.keyPrefix,
      opts.keyFn(c),
      c.env[opts.limitEnvKey] as string | undefined,
      c.env[opts.windowEnvKey] as string | undefined,
    )
    if (!allowed) {
      return c.json({ error: 'RATE_LIMIT_EXCEEDED', message: 'Rate limit exceeded' }, 429)
    }
    await next()
  }
}
