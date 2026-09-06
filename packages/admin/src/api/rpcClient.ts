import { hc } from 'hono/client'
import type { ClientResponse } from 'hono/client'
import type { AdminAppType } from '@hono-bbs/api/admin'
import { env } from '../config/env'
import { useAuthStore } from '../stores/authStore'
import { useTurnstileStore } from '../stores/turnstileStore'
import { ApiError, TurnstileRequiredError } from './client'

// board/thread/post/identity/auth 系エンドポイントの型安全RPCクライアント。
// packages/web の rpcClient.ts と同じ構成 (実行時は通常の fetch()+JSON、AdminAppType は
// 型情報としてのみ import される。ビルド後のバンドルには一切残らない)。
export const client = hc<AdminAppType>(`${env.apiBaseUrl}${env.apiBasePath}`, {
  headers: () => {
    const headers: Record<string, string> = {}
    const sessionId = useAuthStore.getState().sessionId
    if (sessionId) headers['Authorization'] = `Bearer ${sessionId}`
    const turnstileSessionId = useTurnstileStore.getState().sessionId
    if (turnstileSessionId) headers['X-Turnstile-Session'] = turnstileSessionId
    return headers
  },
})

export function requireSession(): void {
  if (!useAuthStore.getState().sessionId) {
    throw new ApiError('UNAUTHORIZED', '未ログインです', 401)
  }
}

export function requireTurnstileSession(): void {
  if (!useTurnstileStore.getState().sessionId) {
    throw new TurnstileRequiredError()
  }
}

// 204→undefined、!ok→ApiErrorを投げる、それ以外→json()。呼び出し側が期待する成功時の型 T を明示する。
export async function unwrap<T>(resPromise: Promise<ClientResponse<unknown>>): Promise<T> {
  const res = await resPromise
  if (res.status === 204) return undefined as T

  const json = await res.json()
  if (!res.ok) {
    const err = json as { error?: string; message?: string; errorCodes?: string[] }
    throw new ApiError(err.error ?? 'UNKNOWN_ERROR', err.message ?? 'エラーが発生しました', res.status, err.errorCodes)
  }
  return json as T
}
