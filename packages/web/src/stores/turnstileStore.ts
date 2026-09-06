import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { env } from '../config/env'

interface TurnstileState {
  sessionId: string | null
  issuedAt: string | null
  setSession: (sessionId: string) => void
  clearSession: () => void
  isValid: () => boolean
}

export const useTurnstileStore = create<TurnstileState>()(
  persist(
    (set, get) => ({
      sessionId: null,
      issuedAt: null,
      setSession: (sessionId) => {
        if (env.disableTurnstile) {
          set({ sessionId: 'dev-turnstile-disabled', issuedAt: new Date().toISOString() })
        } else {
          set({ sessionId, issuedAt: new Date().toISOString() })
        }
      },
      clearSession: () => set({ sessionId: null, issuedAt: null }),
      isValid: () => {
        if (env.disableTurnstile) return true
        const { sessionId, issuedAt } = get()
        if (!sessionId || !issuedAt) return false
        // Turnstileセッションは24時間有効
        const expiresAt = new Date(issuedAt)
        expiresAt.setHours(expiresAt.getHours() + 24)
        return new Date() < expiresAt
      },
    }),
    {
      name: 'bbs-turnstile',
    },
  ),
)
