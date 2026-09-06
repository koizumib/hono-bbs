import { hc } from 'hono/client'
import type { ClientResponse } from 'hono/client'
import type { AppType } from '@hono-bbs/api'
import { env } from '../config/env'
import { useAuthStore } from '../stores/authStore'
import { useTurnstileStore } from '../stores/turnstileStore'
import { ApiError, TurnstileRequiredError } from './client'

// board/thread/post 系エンドポイントの型安全RPCクライアント。
// 実行時には通常の fetch()+JSON を使うだけで、専用プロトコルではない
// (packages/api の AppType は型情報としてのみ import される。ビルド後のバンドルには一切残らない)。
export const client = hc<AppType>(`${env.apiBaseUrl}${env.apiBasePath}`, {
  headers: () => {
    const headers: Record<string, string> = {}
    const sessionId = useAuthStore.getState().sessionId
    if (sessionId) headers['Authorization'] = `Bearer ${sessionId}`
    const turnstileSessionId = useTurnstileStore.getState().sessionId
    if (turnstileSessionId) headers['X-Turnstile-Session'] = turnstileSessionId
    return headers
  },
})

// リクエスト送信前にトークンの有無を確認し、無ければ即座にエラーを投げる
// (現行の apiFetch の requiresSession/requiresTurnstile と同じUX)
export function requireSession(): void {
  if (!useAuthStore.getState().isLoggedIn()) {
    throw new ApiError('UNAUTHORIZED', '未ログインです', 401)
  }
}

// isValid() は VITE_DISABLE_TURNSTILE=true のとき常に true を返す (turnstileStore.ts 参照)。
// 生の sessionId の有無だけを見ると、開発環境で無効化していても常にエラーになってしまう
// (無効化時は各ページの isValid() が既に true を返すため、そもそもセッションを事前設定する
// 処理自体が呼ばれず sessionId が null のままになりうる)。
export function requireTurnstileSession(): void {
  if (!useTurnstileStore.getState().isValid()) {
    throw new TurnstileRequiredError()
  }
}

// apiFetch と同じステータス別のレスポンス処理 (204→undefined、!ok→ApiErrorを投げる、それ以外→json())。
// hc() の返り値は「成功/エラーそれぞれのステータスごとに別々の型」のユニオンなので、
// 呼び出し側が期待する成功時の型 T を明示する (旧 apiFetch<T>() と同じ使い方)。
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
