import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBoards } from '../hooks/useBoards'
import { usePopularThreads } from '../hooks/usePopularThreads'
import { useFavoriteBoardsThreads } from '../hooks/useFavoriteBoardsThreads'
import { useUnreadAcrossHistory } from '../hooks/useUnreadAcrossHistory'
import { useSettingsStore } from '../stores/settingsStore'
import { useAuthStore } from '../stores/authStore'
import { rankMomentumValues } from '../utils/momentum'
import { relativeTime } from '../utils/formatDate'
import { getHistory } from '../utils/threadHistory'
import { useThreadHistoryVersionStore } from '../stores/threadHistoryVersionStore'
import BoardAvatar from '../components/board/BoardAvatar'
import HomeThreadCard, { type HomeThreadCardData } from '../components/home/HomeThreadCard'
import { mapThreadToHomeCardData } from '../utils/threadCardData'
import { env } from '../config/env'
import type { Board } from '../api/types'

const UNCATEGORIZED = 'その他'
const CATEGORY_DISPLAY_LIMIT = 4
const BOARDS_PER_CATEGORY = 4

function appIconInitials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

type FeedTab = 'momentum' | 'favorites' | 'unread'

const FEED_TABS: { key: FeedTab; label: string; icon: string }[] = [
  { key: 'momentum', label: '総合勢い', icon: 'local_fire_department' },
  { key: 'favorites', label: 'お気に入りの板', icon: 'bookmark' },
  { key: 'unread', label: '未読スレッド', icon: 'mark_chat_unread' },
]

export default function TopPage() {
  const navigate = useNavigate()
  const favoriteBoardIds = useSettingsStore((s) => s.favoriteBoardIds)
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn())
  const { data: boardsData } = useBoards()
  const [tab, setTab] = useState<FeedTab>('momentum')

  const boardsById = useMemo(
    () => new Map((boardsData?.data ?? []).map((b) => [b.id, b])),
    [boardsData],
  )

  const favoriteBoards = useMemo(
    () => favoriteBoardIds.map((id) => boardsById.get(id)).filter((b): b is Board => b !== undefined),
    [favoriteBoardIds, boardsById],
  )

  // 「人気板カテゴリ」導線用に、全板をカテゴリごとにまとめる(板数の多いカテゴリ順)
  const categoryGroups = useMemo(() => {
    const map = new Map<string, Board[]>()
    for (const board of boardsData?.data ?? []) {
      const category = board.category?.trim() || UNCATEGORIZED
      if (!map.has(category)) map.set(category, [])
      map.get(category)!.push(board)
    }
    return Array.from(map.entries())
      .map(([category, boards]) => ({ category, boards }))
      .sort((a, b) => b.boards.length - a.boards.length)
      .slice(0, CATEGORY_DISPLAY_LIMIT)
  }, [boardsData])

  // 最近閲覧したスレッド(ローカル履歴、右レール用)
  const historyVersion = useThreadHistoryVersionStore((s) => s.version)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const recentThreads = useMemo(() => getHistory().slice(0, 6), [historyVersion])

  // お気に入り/未読タブは実際に開かれるまでフェッチしない(ホーム画面を開いた瞬間に
  // 全タブ分のリクエストが飛ぶのを避ける)
  const popular = usePopularThreads()
  const favoritesFeed = useFavoriteBoardsThreads(tab === 'favorites')
  const unreadFeed = useUnreadAcrossHistory(tab === 'unread')

  const momentumCards: HomeThreadCardData[] = useMemo(
    () => (popular.data?.data.items ?? []).map((item) => ({
      boardId: item.boardId,
      boardName: item.boardName,
      boardIcon: boardsById.get(item.boardId)?.icon,
      boardColorTheme: boardsById.get(item.boardId)?.colorTheme,
      threadId: item.threadId,
      title: item.title,
      postCount: item.postCount,
      momentum: item.momentum,
      createdAt: item.createdAt,
      opAuthorId: item.opAuthorId,
      opPosterName: item.opPosterName,
      opPosterOptionInfo: item.opPosterOptionInfo,
      opContent: item.opContent,
    })),
    [popular.data, boardsById],
  )

  const favoritesCards: HomeThreadCardData[] = useMemo(
    () => (favoritesFeed.data ?? []).map((t) => mapThreadToHomeCardData(t, boardsById.get(t.boardId))),
    [favoritesFeed.data, boardsById],
  )

  const unreadCards: { data: HomeThreadCardData; unreadCount: number }[] = useMemo(
    () => (unreadFeed.data ?? []).map(({ thread: t, unreadCount }) => ({
      unreadCount,
      data: mapThreadToHomeCardData(t, boardsById.get(t.boardId)),
    })),
    [unreadFeed.data, boardsById],
  )

  const activeCards = tab === 'momentum' ? momentumCards : tab === 'favorites' ? favoritesCards : unreadCards.map((c) => c.data)
  const momentumRankMap = useMemo(
    () => rankMomentumValues(activeCards.map((c) => c.threadId), activeCards.map((c) => c.momentum)),
    [activeCards],
  )
  const isFeedLoading = tab === 'momentum' ? popular.isLoading : tab === 'favorites' ? favoritesFeed.isLoading : unreadFeed.isLoading

  return (
    <div className="flex flex-col h-full w-full overflow-y-auto custom-scrollbar bg-c-base text-c-text-body">
      <div className="max-w-6xl w-full mx-auto px-4 py-6 sm:px-6">
        {/* ヘッダー(モバイルのみ。PCは常設メニューバー(MenuBar)がロゴ/検索導線を担う) */}
        <div className="md:hidden">
          <div className="flex items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3 min-w-0">
              {env.appIcon ? (
                <img src={env.appIcon} alt={env.appName} className="w-10 h-10 rounded-[var(--btn-radius)] flex-shrink-0 object-contain" />
              ) : (
                <div className="w-10 h-10 bg-c-accent rounded-[var(--btn-radius)] flex-shrink-0 flex items-center justify-center font-bold text-[var(--c-accent-text)]">
                  {appIconInitials(env.appName)}
                </div>
              )}
              <h1 className="font-bold text-xl tracking-tight truncate text-c-text-strong">{env.appName}</h1>
            </div>
            <button
              onClick={() => navigate('/settings')}
              className="flex-shrink-0 p-2 text-c-text-muted hover:text-c-text-body rounded-[var(--btn-radius)] hover:bg-c-surface2 transition-colors"
              title={isLoggedIn ? 'アカウント設定' : 'ログイン・設定'}
            >
              <span className="material-symbols-outlined text-2xl">account_circle</span>
            </button>
          </div>

          <button
            onClick={() => navigate('/boards')}
            className="w-full flex items-center gap-3 bg-c-surface border border-c-border rounded-[var(--card-radius)] px-4 py-3 text-left text-c-text-muted hover:border-c-accent/50 transition-colors mb-6"
          >
            <span className="material-symbols-outlined text-xl">search</span>
            <span className="text-sm">板名・キーワードで探す...</span>
          </button>
        </div>

        {/* お気に入りの板(ピン留め) クイックジャンプ */}
        <section className="mb-6">
          <p className="text-[10.5px] font-bold text-c-text-muted uppercase tracking-wider flex items-center gap-1 mb-2 px-1">
            <span className="material-symbols-outlined text-sm">push_pin</span>
            お気に入りの板
          </p>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {favoriteBoards.map((board) => (
              <button
                key={board.id}
                onClick={() => navigate(`/${board.id}`)}
                className="flex items-center gap-2 bg-c-surface hover:bg-c-surface2 px-3 py-1.5 rounded-[var(--btn-radius)] transition-colors shrink-0"
              >
                <BoardAvatar name={board.name} icon={board.icon} colorTheme={board.colorTheme} size={20} />
                <span className="text-xs text-c-text-body whitespace-nowrap">{board.name}</span>
                <span className="font-mono text-[10px] text-c-text-muted whitespace-nowrap">{board.id}</span>
              </button>
            ))}
            <button
              onClick={() => navigate('/boards')}
              className="flex items-center gap-1 text-c-text-muted hover:text-c-text-body bg-c-base hover:bg-c-surface px-3 py-1.5 rounded-[var(--btn-radius)] transition-colors shrink-0 text-xs"
            >
              <span className="material-symbols-outlined text-base">add</span>
              板を追加
            </button>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* メインフィード */}
          <div className="lg:col-span-8 flex flex-col gap-3 min-w-0">
            <div className="bg-c-surface p-1.5 rounded-[var(--card-radius)] flex items-center justify-between gap-1">
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                {FEED_TABS.map(({ key, label, icon }) => {
                  const active = tab === key
                  return (
                    <button
                      key={key}
                      onClick={() => setTab(key)}
                      className={`px-3 py-1.5 rounded-[var(--btn-radius)] text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 ${
                        active ? 'bg-c-surface2 text-c-text-strong' : 'text-c-text-muted hover:text-c-text-body'
                      }`}
                    >
                      <span className={`material-symbols-outlined text-base ${key === 'momentum' ? 'text-c-heat-hot' : ''}`}>{icon}</span>
                      {label}
                    </button>
                  )
                })}
              </div>
              {tab === 'momentum' && popular.data && (
                <span className="text-[10.5px] text-c-text-muted pr-2 flex-shrink-0 whitespace-nowrap">
                  {relativeTime(popular.data.data.computedAt)}更新
                </span>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {isFeedLoading ? (
                <div className="text-center text-c-text-muted text-sm py-10">読み込み中...</div>
              ) : tab === 'favorites' && favoriteBoardIds.length === 0 ? (
                <div className="text-center text-c-text-muted text-xs py-10 border border-dashed border-c-border rounded-[var(--card-radius)]">
                  お気に入りの板はありません。「板を追加」から★登録できます。
                </div>
              ) : tab === 'unread' && unreadCards.length === 0 ? (
                <div className="text-center text-c-text-muted text-xs py-10 border border-dashed border-c-border rounded-[var(--card-radius)]">
                  未読のスレッドはありません
                </div>
              ) : tab === 'momentum' && momentumCards.length === 0 ? (
                <div className="text-center text-c-text-muted text-xs py-10 border border-dashed border-c-border rounded-[var(--card-radius)]">
                  集計中です。しばらくしてから再度お試しください
                </div>
              ) : tab === 'unread' ? (
                unreadCards.map(({ data, unreadCount }) => (
                  <HomeThreadCard
                    key={data.threadId}
                    data={data}
                    unreadCount={unreadCount}
                    momentumRank={momentumRankMap.get(data.threadId) ?? 0}
                  />
                ))
              ) : (
                activeCards.map((data) => (
                  <HomeThreadCard key={data.threadId} data={data} momentumRank={momentumRankMap.get(data.threadId) ?? 0} />
                ))
              )}
            </div>
          </div>

          {/* 右レール: 最近閲覧したスレッド + 人気板カテゴリ */}
          <div className="lg:col-span-4 flex flex-col gap-4 min-w-0">
            <div className="bg-c-surface p-4 rounded-[var(--card-radius)] flex flex-col gap-2">
              <h3 className="text-sm font-bold text-c-text-strong flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-c-accent">history</span>
                最近閲覧したスレッド
              </h3>
              {recentThreads.length === 0 ? (
                <p className="text-xs text-c-text-muted text-center py-4">まだスレッドを見ていません</p>
              ) : (
                recentThreads.map((entry) => (
                  <button
                    key={entry.threadId}
                    onClick={() => navigate(`/${entry.boardId}/${entry.threadId}`)}
                    className="bg-c-base hover:bg-c-surface2 p-2.5 rounded-[var(--btn-radius)] text-left transition-colors flex flex-col gap-0.5 min-w-0"
                  >
                    <span className="font-mono text-[10px] text-c-text-muted truncate">{entry.boardName}</span>
                    <span className="text-xs text-c-text-body font-medium truncate">{entry.threadTitle}</span>
                    <span className="text-[10px] text-c-text-muted">{relativeTime(new Date(entry.timestamp).toISOString())}</span>
                  </button>
                ))
              )}
            </div>

            <div className="bg-c-surface p-4 rounded-[var(--card-radius)] flex flex-col gap-3">
              <h3 className="text-sm font-bold text-c-text-strong flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-c-text-muted">folder_open</span>
                人気板カテゴリ
              </h3>
              {categoryGroups.map((group) => (
                <div key={group.category} className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-c-text-muted uppercase tracking-wider">{group.category}</span>
                  <div className="flex flex-wrap gap-1">
                    {group.boards.slice(0, BOARDS_PER_CATEGORY).map((board) => (
                      <button
                        key={board.id}
                        onClick={() => navigate(`/${board.id}/about`)}
                        className="bg-c-base hover:bg-c-surface2 text-c-text-body px-2 py-1 rounded text-xs transition-colors"
                      >
                        {board.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <button
                onClick={() => navigate('/boards')}
                className="text-c-accent hover:underline text-xs flex items-center gap-1 pt-1 border-t border-c-border mt-1"
              >
                さらに表示(板一覧)
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
