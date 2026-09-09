import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'light' | 'dark' | 'auto' | 'light-gray' | 'gray' | 'dark-gray'
export type AccentColor = 'blue' | 'yellow' | 'pink' | 'purple' | 'orange' | 'green'
export type FontSize = 1 | 2 | 3 | 4 | 5

export type NgTarget = 'threadTitle' | 'posterId' | 'posterName' | 'content'

export interface NgRule {
  id: string
  target: NgTarget
  pattern: string
  isRegex: boolean
  enabled: boolean
}

// v1までの1カテゴリ1テキストエリア形式。マイグレーションでのみ参照する。
interface LegacyNgWords {
  threadTitle: string
  threadTitleRegex: boolean
  posterId: string
  posterIdRegex?: boolean
  posterName: string
  posterNameRegex?: boolean
  content: string
  contentRegex: boolean
}

interface SettingsState {
  theme: Theme
  accentColor: AccentColor
  fontSize: FontSize
  safeSearch: boolean
  ngRules: NgRule[]
  notifications: {
    ownPostReply: boolean
    directMessage: boolean
    announcement: boolean
  }
  historyMaxGenerations: number
  postHistoryMaxGenerations: number
  defaultPosterName: string
  defaultSubInfo: string
  replyLayout: 'bottom' | 'right'
  threadListAutoRefresh: boolean
  threadListRefreshInterval: number
  hiddenBoardIds: string[]
  favoriteBoardIds: string[]
  collapsedCategories: string[]
  setTheme: (theme: Theme) => void
  setAccentColor: (c: AccentColor) => void
  setFontSize: (s: FontSize) => void
  setSafeSearch: (val: boolean) => void
  addNgRule: (rule: Omit<NgRule, 'id'>) => void
  removeNgRule: (id: string) => void
  setNgRuleEnabled: (id: string, enabled: boolean) => void
  setNgRuleRegex: (id: string, isRegex: boolean) => void
  setNotification: (key: keyof SettingsState['notifications'], val: boolean) => void
  setHistoryMaxGenerations: (n: number) => void
  setPostHistoryMaxGenerations: (n: number) => void
  setDefaultPosterName: (s: string) => void
  setDefaultSubInfo: (s: string) => void
  setReplyLayout: (l: 'bottom' | 'right') => void
  setThreadListAutoRefresh: (v: boolean) => void
  setThreadListRefreshInterval: (n: number) => void
  setHiddenBoardIds: (ids: string[]) => void
  toggleFavoriteBoard: (boardId: string) => void
  toggleCategoryCollapsed: (category: string) => void
}

// 旧形式(1カテゴリ1改行区切りテキスト)を新形式(1レコード1件)に変換する
function migrateLegacyNgWords(legacy: LegacyNgWords): NgRule[] {
  const rules: NgRule[] = []
  const pushLines = (text: string, target: NgTarget, isRegex: boolean) => {
    (text ?? '').split('\n').map((w) => w.trim()).filter(Boolean).forEach((pattern) => {
      rules.push({ id: crypto.randomUUID(), target, pattern, isRegex, enabled: true })
    })
  }
  pushLines(legacy.threadTitle, 'threadTitle', legacy.threadTitleRegex)
  pushLines(legacy.posterId, 'posterId', legacy.posterIdRegex ?? false)
  pushLines(legacy.posterName, 'posterName', legacy.posterNameRegex ?? false)
  pushLines(legacy.content, 'content', legacy.contentRegex)
  return rules
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'dark',
      accentColor: 'blue',
      fontSize: 3,
      safeSearch: true,
      ngRules: [],
      notifications: {
        ownPostReply: true,
        directMessage: true,
        announcement: false,
      },
      historyMaxGenerations: 100,
      postHistoryMaxGenerations: 30,
      defaultPosterName: '',
      defaultSubInfo: '',
      replyLayout: 'bottom',
      threadListAutoRefresh: false,
      threadListRefreshInterval: 30,
      hiddenBoardIds: [],
      favoriteBoardIds: [],
      collapsedCategories: [],
      setTheme: (theme) => set({ theme }),
      setAccentColor: (accentColor) => set({ accentColor }),
      setFontSize: (fontSize) => set({ fontSize }),
      setSafeSearch: (safeSearch) => set({ safeSearch }),
      addNgRule: (rule) =>
        set((s) => ({ ngRules: [...s.ngRules, { ...rule, id: crypto.randomUUID() }] })),
      removeNgRule: (id) =>
        set((s) => ({ ngRules: s.ngRules.filter((r) => r.id !== id) })),
      setNgRuleEnabled: (id, enabled) =>
        set((s) => ({ ngRules: s.ngRules.map((r) => (r.id === id ? { ...r, enabled } : r)) })),
      setNgRuleRegex: (id, isRegex) =>
        set((s) => ({ ngRules: s.ngRules.map((r) => (r.id === id ? { ...r, isRegex } : r)) })),
      setNotification: (key, val) =>
        set((s) => ({ notifications: { ...s.notifications, [key]: val } })),
      setHistoryMaxGenerations: (historyMaxGenerations) => set({ historyMaxGenerations }),
      setPostHistoryMaxGenerations: (postHistoryMaxGenerations) => set({ postHistoryMaxGenerations }),
      setDefaultPosterName: (defaultPosterName) => set({ defaultPosterName }),
      setDefaultSubInfo: (defaultSubInfo) => set({ defaultSubInfo }),
      setReplyLayout: (replyLayout) => set({ replyLayout }),
      setThreadListAutoRefresh: (threadListAutoRefresh) => set({ threadListAutoRefresh }),
      setThreadListRefreshInterval: (threadListRefreshInterval) => set({ threadListRefreshInterval }),
      setHiddenBoardIds: (hiddenBoardIds) => set({ hiddenBoardIds }),
      toggleFavoriteBoard: (boardId) =>
        set((s) => ({
          favoriteBoardIds: s.favoriteBoardIds.includes(boardId)
            ? s.favoriteBoardIds.filter((id) => id !== boardId)
            : [...s.favoriteBoardIds, boardId],
        })),
      toggleCategoryCollapsed: (category) =>
        set((s) => ({
          collapsedCategories: s.collapsedCategories.includes(category)
            ? s.collapsedCategories.filter((c) => c !== category)
            : [...s.collapsedCategories, category],
        })),
    }),
    {
      name: 'bbs-settings',
      version: 1,
      migrate: (persisted, version) => {
        const state = persisted as Record<string, unknown>
        if (version < 1 && state.ngWords) {
          const { ngWords, ...rest } = state
          return { ...rest, ngRules: migrateLegacyNgWords(ngWords as LegacyNgWords) }
        }
        return state
      },
    },
  ),
)
