export interface ThreadHistoryEntry {
  threadId: string
  boardId: string
  threadTitle: string
  boardName: string
  lastReadCount: number
  timestamp: number
  lastScrollTop?: number
  /** 0–1 のスクロール進捗（0 = 先頭、1 = 末尾） */
  scrollProgress?: number
}

const STORAGE_KEY = 'bbs-thread-history'
// 旧クッキー名（移行用）
const LEGACY_COOKIE_NAME = 'bbs-thread-history'

function loadHistory(): ThreadHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed as ThreadHistoryEntry[]
    }
    // 旧クッキーからの移行
    const match = document.cookie.match(new RegExp(`${LEGACY_COOKIE_NAME}=([^;]*)`))
    if (match) {
      try {
        const decoded = decodeURIComponent(match[1])
        const parsed = JSON.parse(decoded)
        if (Array.isArray(parsed)) {
          const entries = parsed as ThreadHistoryEntry[]
          saveHistory(entries)
          // 旧クッキーを削除
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

function saveHistory(entries: ThreadHistoryEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // localStorage が使えない場合は無視
  }
}

export function recordThreadView(
  entry: Omit<ThreadHistoryEntry, 'timestamp'>,
  maxGenerations: number,
) {
  const history = loadHistory()
  const existing = history.find((e) => e.threadId === entry.threadId)
  const filtered = history.filter((e) => e.threadId !== entry.threadId)
  const newEntry: ThreadHistoryEntry = {
    lastScrollTop: existing?.lastScrollTop,
    scrollProgress: existing?.scrollProgress,
    ...entry,
    timestamp: Date.now(),
  }
  const trimmed = [newEntry, ...filtered].slice(0, maxGenerations)
  saveHistory(trimmed)
}

export function saveThreadScrollPosition(
  boardId: string,
  threadId: string,
  scrollTop: number,
  scrollProgress?: number,
): void {
  const history = loadHistory()
  const idx = history.findIndex((e) => e.boardId === boardId && e.threadId === threadId)
  if (idx !== -1) {
    history[idx] = { ...history[idx], lastScrollTop: scrollTop, scrollProgress }
    saveHistory(history)
  }
}

export function getHistory(): ThreadHistoryEntry[] {
  return loadHistory()
}

export function clearHistory() {
  localStorage.removeItem(STORAGE_KEY)
}

export function removeThreadFromHistory(threadId: string) {
  const history = loadHistory()
  saveHistory(history.filter((e) => e.threadId !== threadId))
}
