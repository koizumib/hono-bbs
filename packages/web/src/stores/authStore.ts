import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  sessionId: string | null
  userId: string | null
  displayName: string | null
  expiresAt: string | null
  setSession: (sessionId: string, userId: string, displayName: string, expiresAt: string) => void
  clearSession: () => void
  isLoggedIn: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      sessionId: null,
      userId: null,
      displayName: null,
      expiresAt: null,
      setSession: (sessionId, userId, displayName, expiresAt) =>
        set({ sessionId, userId, displayName, expiresAt }),
      clearSession: () =>
        set({ sessionId: null, userId: null, displayName: null, expiresAt: null }),
      isLoggedIn: () => {
        const { sessionId, expiresAt } = get()
        if (!sessionId) return false
        if (expiresAt && new Date(expiresAt) < new Date()) return false
        return true
      },
    }),
    {
      name: 'bbs-auth',
    },
  ),
)
