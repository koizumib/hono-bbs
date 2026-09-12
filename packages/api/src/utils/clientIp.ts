import type { Context } from 'hono'
import type { AppEnv } from '../types'

// クライアントIPの解決を一箇所に集約する。
// Cloudflare Workers環境では CF-Connecting-IP が常に付与される(エッジで上書きされるため
// クライアントが偽装できない)が、CLAUDE.md に記載の代替Node.jsアダプター経由のデプロイでは
// この値が存在しないため、リバースプロキシが設定する X-Forwarded-For にもフォールバックする。
// IPBAN/レート制限の判定に使う識別子がエンドポイントごとにバラバラの解決方法だと、
// 一部の経路だけIP BANが素通りしてしまう不整合が起きるため、必ずこの関数経由にする。
export function getClientIp(c: Context<AppEnv>): string | null {
  const cfIp = c.req.header('CF-Connecting-IP')
  if (cfIp) return cfIp
  const forwarded = c.req.header('X-Forwarded-For')?.split(',')[0]?.trim()
  return forwarded || null
}
