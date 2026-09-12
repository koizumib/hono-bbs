import { useMemo } from 'react'
import { useBoards } from './useBoards'
import { useSettingsStore } from '../stores/settingsStore'
import { useBoardHistoryVersionStore } from '../stores/boardHistoryVersionStore'
import { getBoardHistory } from '../utils/boardHistory'
import type { Board } from '../api/types'

/**
 * サイドバー(BoardSidebar)・ドロワー(MobileBoardDrawer)で共通して使う、
 * 「お気に入り」「最近見た板」だけの軽量な板一覧データを整形するフック(JSXは持たない)。
 * 板の検索自体は /boards (BoardSearchPage・useBoardSearch) に一本化した。
 */
export function useBoardList() {
  const { data, isLoading } = useBoards()
  const favoriteBoardIds = useSettingsStore((s) => s.favoriteBoardIds)
  const toggleFavoriteBoard = useSettingsStore((s) => s.toggleFavoriteBoard)
  const boardHistoryVersion = useBoardHistoryVersionStore((s) => s.version)

  const boardsById = useMemo(() => {
    const map = new Map((data?.data ?? []).map((b) => [b.id, b]))
    return map
  }, [data])

  const favoriteBoards = useMemo(
    () => favoriteBoardIds
      .map((id) => boardsById.get(id))
      .filter((b): b is Board => b !== undefined),
    [favoriteBoardIds, boardsById],
  )

  const recentBoards = useMemo(() => {
    const history = getBoardHistory()
    return history
      .map((e) => boardsById.get(e.boardId))
      .filter((b): b is Board => b !== undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardsById, boardHistoryVersion])

  return {
    isLoading,
    favoriteBoards,
    recentBoards,
    favoriteBoardIds,
    toggleFavoriteBoard,
  }
}
