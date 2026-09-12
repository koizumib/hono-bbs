import { create } from 'zustand'

interface BoardHistoryVersionState {
  version: number
  bump: () => void
}

/**
 * 板の閲覧履歴(localStorage、utils/boardHistory.ts)が更新されたことを、
 * 離れたコンポーネント同士(トップページ ⇔ 板の表示画面)で共有するための
 * 最小限のストア。threadHistoryVersionStore.ts と同じ設計。
 */
export const useBoardHistoryVersionStore = create<BoardHistoryVersionState>((set) => ({
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
}))
