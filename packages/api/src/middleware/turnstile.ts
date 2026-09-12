import type { MiddlewareHandler } from 'hono'
import type { AppEnv } from '../types'
import * as sessionRepository from '../repository/sessionRepository'
import { computeSessionId } from '../features/turnstile/service'
import { getClientIp } from '../utils/clientIp'

// X-Turnstile-Session ヘッダーで Turnstile セッションを検証するミドルウェア
// ENABLE_TURNSTILE=true のときのみ KV 検証を行う。未設定または false のときはスキップ。
export const requireTurnstile: MiddlewareHandler<AppEnv> = async (c, next) => {
  const sessionId = c.req.header('X-Turnstile-Session') ?? null
  c.set('turnstileSessionId', sessionId)

  if (c.env.ENABLE_TURNSTILE !== 'true') {
    await next()
    return
  }

  if (!sessionId) {
    return c.json({ error: 'TURNSTILE_REQUIRED', message: 'X-Turnstile-Session header required' }, 400)
  }

  // セッションIDは発行時のIP+UA+日付から決定論的に生成されている。
  // ここで「今のリクエスト元」から同じ値を再計算し、クライアントが提示したIDと一致するかを
  // 検証する。これをしないと、他人のセッションID(画像メタデータ等から漏れうる)を
  // 誰でもどこからでも使い回せる持ち運び可能なbearerトークンになってしまう。
  const clientIP = getClientIp(c) ?? 'unknown'
  const userAgent = c.req.header('User-Agent') ?? 'unknown'
  const today = new Date().toISOString().slice(0, 10)
  const expectedSessionId = await computeSessionId(clientIP, userAgent, today, c.env.TURNSTILE_SESSION_PEPPER ?? '')
  if (sessionId !== expectedSessionId) {
    return c.json({ error: 'TURNSTILE_INVALID', message: 'Invalid or expired Turnstile session' }, 400)
  }

  const session = await sessionRepository.findTurnstileSessionById(c.get('kv'), sessionId)
  if (!session) {
    return c.json({ error: 'TURNSTILE_INVALID', message: 'Invalid or expired Turnstile session' }, 400)
  }

  await next()
}
