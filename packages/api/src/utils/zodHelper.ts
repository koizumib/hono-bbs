import { ZodError } from 'zod'
import type { Context } from 'hono'

// esbuild bundling 環境では ZodError の class field 初期化順の問題で
// .errors getter (= this.issues) が undefined になる場合がある。
// .issues を直接参照し、optional chaining でフォールバックすることで回避する。

export function isZodError(e: unknown): e is ZodError {
  return e instanceof ZodError || (e instanceof Error && 'issues' in e)
}

export function zodMessage(e: unknown): string {
  const issues = (e as { issues?: Array<{ message?: string }> }).issues
  return issues?.[0]?.message
    ?? (e instanceof Error ? e.message : null)
    ?? 'Validation failed'
}

// @hono/zod-validator の共通エラーハンドラ。バリデーション失敗時に本APIのエラー封筒
// ({error, message}) 形式で 400 を返す (zValidator のデフォルトの失敗レスポンス形式を上書きする)。
export function zValidatorHook(
  result: { success: true } | { success: false; error: unknown },
  c: Context,
) {
  if (!result.success) {
    return c.json({ error: 'VALIDATION_ERROR', message: zodMessage(result.error) }, 400)
  }
}
