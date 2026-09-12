import { useEffect, useRef } from 'react'
import { useAuthStore } from '../stores/authStore'
import { useSettingsStore, SYNCED_SETTINGS_KEYS, type SyncedSettings } from '../stores/settingsStore'
import { getProfile, updatePreferences } from '../api/profile'

const DEBOUNCE_MS = 800

function extractSyncedSettings(): SyncedSettings {
  const state = useSettingsStore.getState()
  const result = {} as Record<string, unknown>
  for (const key of SYNCED_SETTINGS_KEYS) result[key] = state[key]
  return result as SyncedSettings
}

/**
 * ログイン中は「環境」に関わる設定(settingsStore.SYNCED_SETTINGS_KEYS)をアカウントに
 * 同期する。App.tsx のルート直下に一度だけマウントする想定(UIは持たない)。
 * - ログイン検知時: GET /profile の preferences を取得し、ローカルにマージ適用する
 *   (サーバー側に値がある項目だけ上書き。ローカルにしか無い項目はそのまま残す)
 * - 設定変更時: ログイン中であれば800msデバウンスして PUT /profile/preferences で保存する
 */
export function useSettingsSync(): void {
  const sessionId = useAuthStore((s) => s.sessionId)
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn())
  const hydratedForSessionRef = useRef<string | null>(null)
  const skipNextSaveRef = useRef(false)
  const lastSentRef = useRef<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isLoggedIn || !sessionId) return
    if (hydratedForSessionRef.current === sessionId) return
    hydratedForSessionRef.current = sessionId

    let cancelled = false
    getProfile().then((res) => {
      if (cancelled) return
      const prefs = res.data.preferences ?? {}
      const partial: Partial<SyncedSettings> = {}
      let hasAny = false
      for (const key of SYNCED_SETTINGS_KEYS) {
        if (Object.prototype.hasOwnProperty.call(prefs, key)) {
          ;(partial as Record<string, unknown>)[key] = prefs[key]
          hasAny = true
        }
      }
      if (hasAny) {
        // hydrateFromServer による書き込みそのものを「変更」として即座に
        // 送り返さないようにする(取得直後の無駄なPUTを避けるだけで、実害はないが冗長)
        skipNextSaveRef.current = true
        useSettingsStore.getState().hydrateFromServer(partial)
        lastSentRef.current = JSON.stringify(extractSyncedSettings())
      }
    }).catch(() => {
      // 取得失敗時はローカルの現状値のまま進める(通信不調で操作をブロックしない)
    })
    return () => { cancelled = true }
  }, [isLoggedIn, sessionId])

  useEffect(() => {
    const unsubscribe = useSettingsStore.subscribe(() => {
      if (!useAuthStore.getState().isLoggedIn()) return
      if (skipNextSaveRef.current) {
        skipNextSaveRef.current = false
        return
      }
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        const serialized = JSON.stringify(extractSyncedSettings())
        if (serialized === lastSentRef.current) return
        lastSentRef.current = serialized
        updatePreferences(JSON.parse(serialized)).catch(() => {
          // Turnstile未確立などによる自動保存失敗はサイレントに無視する
          // (次回の設定変更、またはTurnstile確立後の変更で再送される)
        })
      }, DEBOUNCE_MS)
    })
    return () => {
      unsubscribe()
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])
}
