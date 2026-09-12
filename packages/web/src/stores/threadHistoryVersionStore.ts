import { create } from 'zustand'

interface ThreadHistoryVersionState {
  version: number
  bump: () => void
}

/**
 * スレッド閲覧履歴(localStorage、utils/threadHistory.ts)が更新されたことを、
 * 離れたコンポーネント同士（板一覧のバッジ表示 ⇔ スレッド表示画面）で
 * 共有するための最小限のストア。threadHistory.ts の書き込み系関数から呼ばれる。
 *
 * これが無いと、スレッドを開いて新着レスを取得しても、その裏にある
 * スレッド一覧(別コンポーネント)は再レンダーされず、既読になったはずの
 * 「+N」バッジが消えずに残ってしまう。
 */
export const useThreadHistoryVersionStore = create<ThreadHistoryVersionState>((set) => ({
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
}))
