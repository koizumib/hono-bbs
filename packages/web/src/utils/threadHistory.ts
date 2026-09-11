import type { QueryClient } from '@tanstack/react-query'
import { useThreadHistoryVersionStore } from '../stores/threadHistoryVersionStore'

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
  // 板一覧側(別コンポーネント)に既読状態が変わったことを知らせる
  useThreadHistoryVersionStore.getState().bump()
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
  useThreadHistoryVersionStore.getState().bump()
}

export function removeThreadFromHistory(threadId: string) {
  const history = loadHistory()
  saveHistory(history.filter((e) => e.threadId !== threadId))
}

/**
 * 閲覧履歴を削除するのに合わせて、そのスレッドの内容(react-queryのキャッシュ)も
 * 破棄する。履歴だけ消してキャッシュが残っていると、再度開いたときに古い投稿数の
 * ままの内容が一瞬表示されてしまう。
 *
 * 履歴の削除自体は即座に行うが、キャッシュの削除は少し遅らせる。今まさに表示中の
 * スレッド(閉じるアニメーション中でまだアンマウントされていない場合など)に対して
 * removeQueries を呼ぶと、react-query がそのクエリを「新規の空クエリ」とみなして
 * 即座に再フェッチしてしまい、その結果で recordThreadView が再び走って、たった今
 * 削除したはずの履歴を復活させてしまう(かつ表示中の画面がチラつく)ことがある。
 * アンマウントが確実に完了しているであろうタイミングまで遅延させることでこれを防ぐ。
 */
export function forgetThread(queryClient: QueryClient, boardId: string, threadId: string): void {
  removeThreadFromHistory(threadId)
  setTimeout(() => {
    queryClient.removeQueries({ queryKey: ['posts', boardId, threadId] })
  }, 300)
}
