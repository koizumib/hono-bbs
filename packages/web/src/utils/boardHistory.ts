import { useBoardHistoryVersionStore } from '../stores/boardHistoryVersionStore'

export interface BoardHistoryEntry {
  boardId: string
  timestamp: number
}

const STORAGE_KEY = 'bbs-board-history'
const MAX_ENTRIES = 20

function loadHistory(): BoardHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as BoardHistoryEntry[]) : []
  } catch {
    return []
  }
}

function saveHistory(entries: BoardHistoryEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // localStorage が使えない場合は無視
  }
  useBoardHistoryVersionStore.getState().bump()
}

// MRU順(最近見た順)、上限MAX_ENTRIES件のシンプルな板閲覧履歴。
// スレッド既読履歴(threadHistory.ts)と同様、端末ローカルの行動記録なので
// サーバー同期(設定のサーバー同期)の対象には含めない。
export function recordBoardView(boardId: string): void {
  const history = loadHistory()
  const filtered = history.filter((e) => e.boardId !== boardId)
  const trimmed = [{ boardId, timestamp: Date.now() }, ...filtered].slice(0, MAX_ENTRIES)
  saveHistory(trimmed)
}

export function getBoardHistory(): BoardHistoryEntry[] {
  return loadHistory()
}

export function clearBoardHistory(): void {
  localStorage.removeItem(STORAGE_KEY)
  useBoardHistoryVersionStore.getState().bump()
}
