/**
 * 下書きキャッシュ — localStorage を使用
 * cookie は日本語テキストのエンコード後に 4KB 制限を超えるため localStorage を採用
 */

const THREAD_DRAFTS_KEY = 'bbs-thread-drafts'
const POST_DRAFTS_KEY = 'bbs-post-drafts'

interface ThreadDraft {
  boardId: string
  title: string
  content: string
  timestamp: number
}

interface PostDraft {
  boardId: string
  threadId: string
  content: string
  timestamp: number
}

function loadJson<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    return JSON.parse(raw) as T[]
  } catch {
    return []
  }
}

function saveJson<T>(key: string, data: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch {
    // localStorage が使えない場合は無視
  }
}

// ── スレッド作成下書き ──

export function getThreadDraft(boardId: string): ThreadDraft | null {
  return loadJson<ThreadDraft>(THREAD_DRAFTS_KEY).find((d) => d.boardId === boardId) ?? null
}

export function saveThreadDraft(
  boardId: string,
  title: string,
  content: string,
  maxGen: number,
) {
  const drafts = loadJson<ThreadDraft>(THREAD_DRAFTS_KEY).filter((d) => d.boardId !== boardId)
  drafts.push({ boardId, title, content, timestamp: Date.now() })
  // タイムスタンプ昇順で保持し、上限を超えたら古いものを削除
  drafts.sort((a, b) => a.timestamp - b.timestamp)
  saveJson(THREAD_DRAFTS_KEY, drafts.slice(-maxGen))
}

export function clearThreadDraft(boardId: string) {
  saveJson(
    THREAD_DRAFTS_KEY,
    loadJson<ThreadDraft>(THREAD_DRAFTS_KEY).filter((d) => d.boardId !== boardId),
  )
}

// ── レス書き込み下書き ──

export function getPostDraft(boardId: string, threadId: string): PostDraft | null {
  return (
    loadJson<PostDraft>(POST_DRAFTS_KEY).find(
      (d) => d.boardId === boardId && d.threadId === threadId,
    ) ?? null
  )
}

export function savePostDraft(
  boardId: string,
  threadId: string,
  content: string,
  maxGen: number,
) {
  const drafts = loadJson<PostDraft>(POST_DRAFTS_KEY).filter(
    (d) => !(d.boardId === boardId && d.threadId === threadId),
  )
  drafts.push({ boardId, threadId, content, timestamp: Date.now() })
  drafts.sort((a, b) => a.timestamp - b.timestamp)
  saveJson(POST_DRAFTS_KEY, drafts.slice(-maxGen))
}

export function clearPostDraft(boardId: string, threadId: string) {
  saveJson(
    POST_DRAFTS_KEY,
    loadJson<PostDraft>(POST_DRAFTS_KEY).filter(
      (d) => !(d.boardId === boardId && d.threadId === threadId),
    ),
  )
}
