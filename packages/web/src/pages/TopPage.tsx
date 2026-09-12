import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBoards } from '../hooks/useBoards'
import { useSettingsStore } from '../stores/settingsStore'
import { useBoardHistoryVersionStore } from '../stores/boardHistoryVersionStore'
import { getBoardHistory } from '../utils/boardHistory'
import { useAuthStore } from '../stores/authStore'
import { env } from '../config/env'
import type { Board } from '../api/types'

function appIconInitials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export default function TopPage() {
  const navigate = useNavigate()
  const favoriteBoardIds = useSettingsStore((s) => s.favoriteBoardIds)
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn())
  const { data } = useBoards()
  const boardHistoryVersion = useBoardHistoryVersionStore((s) => s.version)

  const boardsById = useMemo(() => {
    return new Map((data?.data ?? []).map((b) => [b.id, b]))
  }, [data])

  const favoriteBoards = useMemo(
    () => favoriteBoardIds.map((id) => boardsById.get(id)).filter((b): b is Board => b !== undefined),
    [favoriteBoardIds, boardsById],
  )

  const recentBoards = useMemo(() => {
    const history = getBoardHistory()
    return history
      .map((e) => boardsById.get(e.boardId))
      .filter((b): b is Board => b !== undefined)
      .slice(0, 8)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardsById, boardHistoryVersion])

  return (
    <div className="flex flex-col h-full w-full overflow-y-auto custom-scrollbar bg-c-base text-c-text-body">
      <div className="max-w-2xl w-full mx-auto px-4 py-8 sm:px-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between gap-3 mb-8">
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

        {/* 板を探す導線(検索はここから) */}
        <button
          onClick={() => navigate('/boards')}
          className="w-full flex items-center gap-3 bg-c-surface border border-c-border rounded-[var(--card-radius)] px-4 py-3 text-left text-c-text-muted hover:border-c-accent/50 transition-colors mb-8"
        >
          <span className="material-symbols-outlined text-xl">search</span>
          <span className="text-sm">板名・キーワードで探す...</span>
        </button>

        {/* お気に入り */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-c-text-strong flex items-center gap-1.5">
              <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
              お気に入り
            </h2>
          </div>
          {favoriteBoards.length === 0 ? (
            <div className="text-center text-c-text-muted text-xs py-6 border border-dashed border-c-border rounded-[var(--card-radius)]">
              お気に入りの板はありません。「板を探す」から★登録できます。
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {favoriteBoards.map((board) => (
                <button
                  key={board.id}
                  onClick={() => navigate(`/${board.id}`)}
                  className="text-left bg-c-surface border border-c-border rounded-[var(--card-radius)] px-3 py-2.5 hover:border-c-accent/50 transition-colors min-w-0"
                >
                  <p className="text-sm font-medium truncate">{board.name}</p>
                  <p className="text-[10px] text-c-text-muted font-mono truncate">{board.threadCount}スレッド</p>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* 最近見た板 */}
        <section>
          <h2 className="text-sm font-bold text-c-text-strong flex items-center gap-1.5 mb-3">
            <span className="material-symbols-outlined text-lg">history</span>
            最近見た板
          </h2>
          {recentBoards.length === 0 ? (
            <div className="text-center text-c-text-muted text-xs py-6 border border-dashed border-c-border rounded-[var(--card-radius)]">
              まだ板を見ていません
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {recentBoards.map((board) => (
                <button
                  key={board.id}
                  onClick={() => navigate(`/${board.id}`)}
                  className="text-left bg-c-surface border border-c-border rounded-[var(--card-radius)] px-3 py-2.5 hover:border-c-accent/50 transition-colors min-w-0"
                >
                  <p className="text-sm font-medium truncate">{board.name}</p>
                  <p className="text-[10px] text-c-text-muted font-mono truncate">{board.threadCount}スレッド</p>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
