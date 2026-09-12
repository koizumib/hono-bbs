import { useQuery } from '@tanstack/react-query'
import { getThreads } from '../api/threads'
import { getHistory } from '../utils/threadHistory'
import { useThreadHistoryVersionStore } from '../stores/threadHistoryVersionStore'
import type { Thread } from '../api/types'

const HISTORY_SCAN_LIMIT = 20

export interface UnreadHistoryThread {
  thread: Thread
  lastReadCount: number
  unreadCount: number
}

// ホーム画面の「未読スレッド」タブ用。閲覧履歴(ローカル)上位N件について現在のレス数を
// 調べ直し、前回既読数より増えているものだけ抽出する。
//
// 履歴の板ごとにグルーピングし、板ごとに1回だけスレッド一覧(GET /boards/:boardId/threads)を
// 取得して、その中から該当スレッドの現在のレス数を引く。以前はスレッドの数だけ個別に
// GET /boards/:boardId/threads/:threadId を叩いていたが、同じ板を何度も読んでいる場合
// (よくあるケース)にリクエスト数が無駄に多くなる上、そもそも一覧を取れば済む話だった。
// (直近に更新されていないスレッドは一覧の最初のページに出てこないことがあるが、その場合は
// 「未読情報なし」として扱う=見送る。全ページを追う程のコストはかけない)
export function useUnreadAcrossHistory(enabled: boolean) {
  const historyVersion = useThreadHistoryVersionStore((s) => s.version)
  return useQuery({
    queryKey: ['unread-across-history', historyVersion],
    queryFn: async (): Promise<UnreadHistoryThread[]> => {
      const entries = getHistory().slice(0, HISTORY_SCAN_LIMIT)
      const boardIds = Array.from(new Set(entries.map((e) => e.boardId)))

      const perBoard = await Promise.all(
        boardIds.map(async (boardId) => {
          try {
            const res = await getThreads(boardId, { limit: 100 })
            return [boardId, new Map(res.data.map((t) => [t.id, t]))] as const
          } catch {
            return [boardId, new Map<string, Thread>()] as const
          }
        }),
      )
      const threadsByBoard = new Map(perBoard)

      const results: UnreadHistoryThread[] = []
      for (const entry of entries) {
        const thread = threadsByBoard.get(entry.boardId)?.get(entry.threadId)
        if (thread && thread.postCount > entry.lastReadCount) {
          results.push({ thread, lastReadCount: entry.lastReadCount, unreadCount: thread.postCount - entry.lastReadCount })
        }
      }
      return results.sort((a, b) => b.unreadCount - a.unreadCount)
    },
    enabled,
    staleTime: 60_000,
  })
}
