import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { env } from '../config/env'

interface TurnstileState {
  sessionId: string | null
  setSession: (sessionId: string) => void
  clearSession: () => void
  isValid: () => boolean
}

// セッションの実際の有効期限は、発行時にサーバー側でTURNSTILE_TOKEN_TTLに基づいて
// KVに設定される (packages/api/src/features/turnstile/service.ts)。
// 以前はここで独自に「24時間で失効」というクライアント側の期限切れ判定をしており、
// サーバー側のTTLをどれだけ長く設定してもクライアントが24時間で見切りをつけて
// 再認証を要求してしまっていた。sessionIdの有無だけを見て、実際の期限切れ判定は
// サーバーに委ねる(期限切れなら通常のAPIリクエストがTurnstileRequiredErrorを返すので、
// 既存のエラーハンドリングフローで再認証を促せる)。
export const useTurnstileStore = create<TurnstileState>()(
  persist(
    (set, get) => ({
      sessionId: null,
      setSession: (sessionId) => {
        set({ sessionId: env.disableTurnstile ? 'dev-turnstile-disabled' : sessionId })
      },
      clearSession: () => set({ sessionId: null }),
      isValid: () => {
        if (env.disableTurnstile) return true
        return Boolean(get().sessionId)
      },
    }),
    {
      name: 'bbs-turnstile',
    },
  ),
)
