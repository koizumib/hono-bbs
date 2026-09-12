import type { Context, MiddlewareHandler } from 'hono'
import type { AppEnv } from '../types'
import type { KvAdapter } from '../adapters/kv'

// 環境変数が明示的に設定されていないときは defaultLimit を使う。
// "0" を明示的に設定した場合のみ、運用者の意図的な選択として無制限を許可する。
function parseLimit(s: string | undefined, defaultLimit: number): number {
  if (s === undefined) return Math.max(0, defaultLimit)
  return Math.max(0, parseInt(s, 10) || 0)
}

function parseWindowMs(s: string | undefined): number {
  const minutes = Math.max(1, parseInt(s ?? '60', 10) || 60)
  return minutes * 60 * 1000
}

// Sliding Window Log方式でカウントし、許可されれば記録する。
// limit=0 (環境変数を明示的に"0"にした場合)、または kv 未設定のときは常に許可 (無制限)。
// 環境変数が未設定(undefined)のときは defaultLimit を適用する — 連投/フラッド対策を
// 「運用者が明示的に設定しない限り無制限」にしてしまわないための安全側デフォルト。
// 各機能(ログイン失敗・画像アップロード・スレッド/投稿作成・Turnstile発行)で
// バラバラに実装されていたレート制限ロジックの共通部分をここに集約する。
export async function checkAndRecord(
  kv: KvAdapter | undefined,
  keyPrefix: string,
  identifier: string,
  limitStr: string | undefined,
  windowStr: string | undefined,
  defaultLimit = 0,
): Promise<boolean> {
  const limit = parseLimit(limitStr, defaultLimit)
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
  defaultLimit?: number
}): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const allowed = await checkAndRecord(
      c.get('kv'),
      opts.keyPrefix,
      opts.keyFn(c),
      c.env[opts.limitEnvKey] as string | undefined,
      c.env[opts.windowEnvKey] as string | undefined,
      opts.defaultLimit,
    )
    if (!allowed) {
      return c.json({ error: 'RATE_LIMIT_EXCEEDED', message: 'Rate limit exceeded' }, 429)
    }
    await next()
  }
}
