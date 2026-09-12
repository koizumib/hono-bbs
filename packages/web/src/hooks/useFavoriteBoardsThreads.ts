import { useQuery } from '@tanstack/react-query'
import { useSettingsStore } from '../stores/settingsStore'
import { getThreads } from '../api/threads'
import { calculateMomentum } from '../utils/momentum'
import type { Thread } from '../api/types'

const PER_BOARD_LIMIT = 10
const RESULT_LIMIT = 20

// ホーム画面の「お気に入りの板」タブ用。各お気に入り板の最新スレッド(1ページ分)を
// 並行取得し、勢い順にマージして上位を返す。板数が多いと重くなるため、板ごとの
// 取得件数は絞る(全件は取りに行かない)。enabled=falseの間(タブが開かれるまで)は
// 取得しない。
export function useFavoriteBoardsThreads(enabled: boolean) {
  const favoriteBoardIds = useSettingsStore((s) => s.favoriteBoardIds)
  return useQuery({
    queryKey: ['favorite-boards-threads', favoriteBoardIds],
    queryFn: async (): Promise<Thread[]> => {
      const results = await Promise.all(
        favoriteBoardIds.map(async (boardId) => {
          try {
            const res = await getThreads(boardId, { limit: PER_BOARD_LIMIT })
            return res.data
          } catch {
            return []
          }
        }),
      )
      return results
        .flat()
        .sort((a, b) => calculateMomentum(b) - calculateMomentum(a))
        .slice(0, RESULT_LIMIT)
    },
    enabled: enabled && favoriteBoardIds.length > 0,
    staleTime: 60_000,
  })
}
