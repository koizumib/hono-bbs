import { useMemo, useState } from 'react'
import { useBoards } from './useBoards'
import { useSettingsStore } from '../stores/settingsStore'
import type { Board } from '../api/types'

const UNCATEGORIZED = 'その他'

export interface BoardCategoryGroup {
  category: string
  boards: Board[]
}

/**
 * サイドバー(BoardSidebar)・ドロワー(MobileBoardDrawer)で共通して使う、
 * 板一覧の検索・お気に入り・カテゴリ分類のデータ整形だけを担当するフック (JSXは持たない)。
 */
export function useBoardList() {
  const { data, isLoading } = useBoards()
  const hiddenBoardIds = useSettingsStore((s) => s.hiddenBoardIds)
  const favoriteBoardIds = useSettingsStore((s) => s.favoriteBoardIds)
  const toggleFavoriteBoard = useSettingsStore((s) => s.toggleFavoriteBoard)
  const collapsedCategories = useSettingsStore((s) => s.collapsedCategories)
  const toggleCategoryCollapsed = useSettingsStore((s) => s.toggleCategoryCollapsed)

  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<'favorites' | 'all'>('all')

  const boards = useMemo(
    () => (data?.data ?? []).filter((b) => !hiddenBoardIds.includes(b.id)),
    [data, hiddenBoardIds],
  )

  const filteredBoards = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return boards
    return boards.filter((b) => b.name.toLowerCase().includes(q) || b.id.toLowerCase().includes(q))
  }, [boards, query])

  const favoriteBoards = useMemo(
    () => filteredBoards.filter((b) => favoriteBoardIds.includes(b.id)),
    [filteredBoards, favoriteBoardIds],
  )

  const categoryGroups = useMemo<BoardCategoryGroup[]>(() => {
    const map = new Map<string, Board[]>()
    for (const board of filteredBoards) {
      const category = board.category?.trim() || UNCATEGORIZED
      if (!map.has(category)) map.set(category, [])
      map.get(category)!.push(board)
    }
    return Array.from(map.entries()).map(([category, boards]) => ({ category, boards }))
  }, [filteredBoards])

  return {
    isLoading,
    query,
    setQuery,
    tab,
    setTab,
    boards,
    favoriteBoards,
    categoryGroups,
    favoriteBoardIds,
    toggleFavoriteBoard,
    collapsedCategories,
    toggleCategoryCollapsed,
  }
}
