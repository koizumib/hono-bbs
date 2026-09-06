export interface PostHistoryEntry {
  type: 'post' | 'thread'
  boardId: string
  threadId: string
  threadTitle: string
  contentSnippet: string
  timestamp: number
  postNumber?: number
}

const STORAGE_KEY = 'bbs-post-history'

function loadHistory(): PostHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed as PostHistoryEntry[]
  } catch {
    return []
  }
}

function saveHistory(entries: PostHistoryEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // localStorage容量超過時は古いものから削除して再試行
    const trimmed = entries.slice(0, Math.floor(entries.length / 2))
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
    } catch {
      // 再試行も失敗した場合は無視
    }
  }
}

export function recordPost(
  entry: Omit<PostHistoryEntry, 'timestamp'>,
  maxGenerations: number,
) {
  const history = loadHistory()
  const newEntry: PostHistoryEntry = { ...entry, timestamp: Date.now() }
  // 古い履歴は末尾から削除、上限を超えないようにする
  const trimmed = [newEntry, ...history].slice(0, maxGenerations)
  saveHistory(trimmed)
}

export function getPostHistory(): PostHistoryEntry[] {
  return loadHistory()
}

export function clearPostHistory() {
  localStorage.removeItem(STORAGE_KEY)
}
