import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'light' | 'dark' | 'auto' | 'light-gray' | 'gray' | 'dark-gray'
export type AccentColor = 'blue' | 'yellow' | 'pink' | 'purple' | 'orange' | 'green'
export type FontSize = 1 | 2 | 3 | 4 | 5

interface NgWords {
  threadTitle: string
  threadTitleRegex: boolean
  posterId: string
  posterName: string
  content: string
  contentRegex: boolean
}

interface SettingsState {
  theme: Theme
  accentColor: AccentColor
  fontSize: FontSize
  safeSearch: boolean
  ngWords: NgWords
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
  setTheme: (theme: Theme) => void
  setAccentColor: (c: AccentColor) => void
  setFontSize: (s: FontSize) => void
  setSafeSearch: (val: boolean) => void
  setNgWords: (ngWords: Partial<NgWords>) => void
  setNotification: (key: keyof SettingsState['notifications'], val: boolean) => void
  setHistoryMaxGenerations: (n: number) => void
  setPostHistoryMaxGenerations: (n: number) => void
  setDefaultPosterName: (s: string) => void
  setDefaultSubInfo: (s: string) => void
  setReplyLayout: (l: 'bottom' | 'right') => void
  setThreadListAutoRefresh: (v: boolean) => void
  setThreadListRefreshInterval: (n: number) => void
  setHiddenBoardIds: (ids: string[]) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'dark',
      accentColor: 'blue',
      fontSize: 3,
      safeSearch: true,
      ngWords: {
        threadTitle: '',
        threadTitleRegex: false,
        posterId: '',
        posterName: '',
        content: '',
        contentRegex: false,
      },
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
      setTheme: (theme) => set({ theme }),
      setAccentColor: (accentColor) => set({ accentColor }),
      setFontSize: (fontSize) => set({ fontSize }),
      setSafeSearch: (safeSearch) => set({ safeSearch }),
      setNgWords: (words) =>
        set((s) => ({ ngWords: { ...s.ngWords, ...words } })),
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
    }),
    {
      name: 'bbs-settings',
    },
  ),
)
