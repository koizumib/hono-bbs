const STORAGE_KEY = 'bbs-tos-agreed'
const LEGACY_COOKIE_KEY = 'bbs-tos-agreed'

export function hasTosAgreed(): boolean {
  try {
    if (localStorage.getItem(STORAGE_KEY) === 'true') return true
    // 旧クッキーからの移行
    if (document.cookie.split(';').some((c) => c.trim().startsWith(`${LEGACY_COOKIE_KEY}=true`))) {
      setTosAgreed()
      document.cookie = `${LEGACY_COOKIE_KEY}=; path=/; max-age=0; SameSite=Strict`
      return true
    }
    return false
  } catch {
    return false
  }
}

export function setTosAgreed(): void {
  try {
    localStorage.setItem(STORAGE_KEY, 'true')
  } catch {
    // ignore
  }
}
