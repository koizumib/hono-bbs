export interface ImageHistoryEntry {
  imageId: string
  deleteToken: string
  url: string
  originalFilename: string | null
  contentType: string
  size: number | null
  uploadedAt: number
}

const STORAGE_KEY = 'bbs-image-history'
const LEGACY_COOKIE_NAME = 'bbs-image-history'
const MAX_ENTRIES = 20

function loadHistory(): ImageHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed as ImageHistoryEntry[]
    }
    // 旧クッキーからの移行
    const match = document.cookie.match(new RegExp(`${LEGACY_COOKIE_NAME}=([^;]*)`))
    if (match) {
      try {
        const decoded = decodeURIComponent(match[1])
        const parsed = JSON.parse(decoded)
        if (Array.isArray(parsed)) {
          const entries = parsed as ImageHistoryEntry[]
          saveHistory(entries)
          document.cookie = `${LEGACY_COOKIE_NAME}=; path=/; max-age=0; SameSite=Strict`
          return entries
        }
      } catch {
        // 移行失敗は無視
      }
    }
    return []
  } catch {
    return []
  }
}

function saveHistory(entries: ImageHistoryEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // ignore
  }
}

export function recordImage(entry: ImageHistoryEntry) {
  const history = loadHistory()
  const trimmed = [entry, ...history.filter((e) => e.imageId !== entry.imageId)].slice(0, MAX_ENTRIES)
  saveHistory(trimmed)
}

export function getImageHistory(): ImageHistoryEntry[] {
  return loadHistory()
}

export function removeImageFromHistory(imageId: string) {
  saveHistory(loadHistory().filter((e) => e.imageId !== imageId))
}

export function clearImageHistory() {
  localStorage.removeItem(STORAGE_KEY)
}
