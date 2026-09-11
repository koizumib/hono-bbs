import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ColorScheme = 'indigo' | 'amber-teal' | 'indigo-light' | 'amber-teal-light'
export type DesignPattern = 'tonal' | 'bordered'
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
  scheme: ColorScheme
  pattern: DesignPattern
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
  /** スマホのスワイプジェスチャーの感度 (1=鈍い〜5=敏感、既定3) */
  gestureSensitivity: 1 | 2 | 3 | 4 | 5
  setScheme: (scheme: ColorScheme) => void
  setPattern: (pattern: DesignPattern) => void
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
  setGestureSensitivity: (level: 1 | 2 | 3 | 4 | 5) => void
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
      scheme: 'indigo',
      pattern: 'tonal',
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
      gestureSensitivity: 3,
      setScheme: (scheme) => set({ scheme }),
      setPattern: (pattern) => set({ pattern }),
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
      setGestureSensitivity: (gestureSensitivity) => set({ gestureSensitivity }),
    }),
    {
      name: 'bbs-settings',
      version: 2,
      migrate: (persisted, version) => {
        let state = persisted as Record<string, unknown>
        if (version < 1 && state.ngWords) {
          const { ngWords, ...rest } = state
          state = { ...rest, ngRules: migrateLegacyNgWords(ngWords as LegacyNgWords) }
        }
        if (version < 2) {
          // 旧テーマ(5種)+アクセントカラー(6種)を、新カラースキーム(4種)+
          // デザインパターン(2種)に置き換える。旧値からの厳密な対応は無いため、
          // ダーク系だったか/ライト系だったかだけ引き継ぎ、残りは既定値にする。
          const { theme, accentColor, ...rest } = state
          const wasLight = theme === 'light' || theme === 'light-gray'
          state = { ...rest, scheme: wasLight ? 'indigo-light' : 'indigo', pattern: 'tonal' }
          void accentColor
        }
        return state
      },
    },
  ),
)
