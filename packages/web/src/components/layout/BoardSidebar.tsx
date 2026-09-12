import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useBoardList } from '../../hooks/useBoardList'
import { useAuthStore } from '../../stores/authStore'
import LoginModal from '../auth/LoginModal'
import BoardListRow from './BoardListRow'
import { env } from '../../config/env'

function appIconInitials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function readSidebarCookie(): boolean {
  try {
    const m = document.cookie.match(/bbs-sidebar-collapsed=([^;]*)/)
    return m ? m[1] === 'true' : false
  } catch { return false }
}

export default function BoardSidebar() {
  const [collapsed, setCollapsed] = useState(() => readSidebarCookie())
  const [showLogin, setShowLogin] = useState(false)
  const { boardId } = useParams()
  const navigate = useNavigate()
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn())
  const displayName = useAuthStore((s) => s.displayName)
  const clearSession = useAuthStore((s) => s.clearSession)
  const {
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
  } = useBoardList()

  async function handleLogout() {
    clearSession()
  }

  return (
    <>
      <aside
        className={`flex-shrink-0 border-r border-c-border bg-c-surface shadow-sm flex flex-col relative transition-all duration-300 ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
        {/* ヘッダー */}
        <div className="p-6 border-b border-c-border flex items-center justify-between">
          <button
            className="flex items-center gap-3 overflow-hidden hover:opacity-80 transition-opacity"
            onClick={() => navigate('/')}
            title="トップへ戻る"
          >
            {env.appIcon ? (
              <img src={env.appIcon} alt={env.appName} className="w-8 h-8 rounded-[var(--btn-radius)] flex-shrink-0 object-contain" />
            ) : (
              <div className="w-8 h-8 bg-c-accent rounded-[var(--btn-radius)] flex-shrink-0 flex items-center justify-center font-bold text-[var(--c-accent-text)] text-sm">
                {appIconInitials(env.appName)}
              </div>
            )}
            {!collapsed && (
              <h1 className="font-bold text-lg tracking-tight truncate whitespace-nowrap text-c-text-strong">
                {env.appName}
              </h1>
            )}
          </button>
          <button
            onClick={() => {
              const next = !collapsed
              document.cookie = `bbs-sidebar-collapsed=${next}; path=/; max-age=${365*24*3600}; SameSite=Strict`
              setCollapsed(next)
            }}
            className="p-1 hover:bg-c-surface2 rounded text-c-text-muted flex-shrink-0"
            title="サイドバーを切り替え"
          >
            <span className="material-symbols-outlined text-xl">
              {collapsed ? 'menu' : 'menu_open'}
            </span>
          </button>
        </div>

        {/* 板一覧 */}
        {collapsed ? (
          // 折りたたみ時はアイコンのみのレール表示。アクティブは背景/左線ではなく
          // アイコン自体の色(アクセントカラー)だけで示す(サンプルデザインのrail準拠)
          <nav className="flex-1 overflow-y-auto custom-scrollbar py-4">
            {isLoading ? (
              <div className="px-5 py-3 text-c-text-muted text-sm">読み込み中...</div>
            ) : (
              <ul className="space-y-2">
                {boards.map((board) => (
                  <li key={board.id} className="flex justify-center">
                    <button
                      onClick={() => navigate(`/${board.id}`)}
                      className={`flex items-center justify-center w-9 h-9 rounded-[var(--btn-radius)] transition-colors ${
                        boardId === board.id ? 'text-c-accent' : 'text-c-text-muted hover:text-c-text-body hover:bg-c-surface2'
                      }`}
                      title={board.name}
                    >
                      <span className={`material-symbols-outlined text-xl flex-shrink-0 ${boardId === board.id ? 'fill' : ''}`}>forum</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </nav>
        ) : (
          <nav className="flex-1 flex flex-col min-h-0">
            {/* 検索 */}
            <div className="p-3 flex-shrink-0">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="板名・キーワード絞り込み..."
                className="w-full bg-c-surface2 border border-c-border rounded-[var(--btn-radius)] px-3 py-1.5 text-sm text-c-text-body placeholder-c-text-muted focus:outline-none focus:ring-1 focus:ring-c-accent/50"
              />
            </div>

            {/* タブ */}
            <div className="flex border-b border-c-border flex-shrink-0 text-sm">
              <button
                onClick={() => setTab('favorites')}
                className={`flex-1 py-2 font-medium border-b-2 transition-colors ${
                  tab === 'favorites'
                    ? 'border-c-accent text-c-accent'
                    : 'border-transparent text-c-text-muted hover:text-c-text-body'
                }`}
              >
                お気に入り ({favoriteBoardIds.length})
              </button>
              <button
                onClick={() => setTab('all')}
                className={`flex-1 py-2 font-medium border-b-2 transition-colors ${
                  tab === 'all'
                    ? 'border-c-accent text-c-accent'
                    : 'border-transparent text-c-text-muted hover:text-c-text-body'
                }`}
              >
                全板一覧 ({boards.length})
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar py-2">
              {isLoading ? (
                <div className="px-5 py-3 text-c-text-muted text-sm">読み込み中...</div>
              ) : tab === 'favorites' ? (
                favoriteBoards.length === 0 ? (
                  <div className="px-4 py-6 text-center text-c-text-muted text-xs">
                    お気に入りの板はありません
                  </div>
                ) : (
                  favoriteBoards.map((board) => (
                    <BoardListRow
                      key={board.id}
                      board={board}
                      isActive={boardId === board.id}
                      isFavorite
                      onToggleFavorite={() => toggleFavoriteBoard(board.id)}
                      onClick={() => navigate(`/${board.id}`)}
                    />
                  ))
                )
              ) : (
                categoryGroups.map((group) => {
                  const isCollapsed = collapsedCategories.includes(group.category)
                  return (
                    <div key={group.category}>
                      <button
                        onClick={() => toggleCategoryCollapsed(group.category)}
                        className="w-full flex items-center justify-between px-4 py-1.5 text-[10px] font-semibold text-c-text-muted uppercase tracking-wider hover:text-c-text-body transition-colors"
                      >
                        <span>{group.category} ({group.boards.length})</span>
                        <span
                          className="material-symbols-outlined text-sm transition-transform"
                          style={{ transform: isCollapsed ? 'rotate(-90deg)' : undefined }}
                        >
                          expand_more
                        </span>
                      </button>
                      {!isCollapsed && group.boards.map((board) => (
                        <BoardListRow
                          key={board.id}
                          board={board}
                          isActive={boardId === board.id}
                          isFavorite={favoriteBoardIds.includes(board.id)}
                          onToggleFavorite={() => toggleFavoriteBoard(board.id)}
                          onClick={() => navigate(`/${board.id}`)}
                        />
                      ))}
                    </div>
                  )
                })
              )}
            </div>
          </nav>
        )}

        {/* フッター */}
        <div className="border-t border-c-border p-2 space-y-1">
          {isLoggedIn ? (
            <>
              <button
                onClick={() => navigate('/settings')}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-c-surface2 transition-colors rounded-[var(--btn-radius)]"
                title={displayName ?? 'ユーザー情報'}
              >
                <div className="w-7 h-7 rounded-full bg-c-surface3 flex items-center justify-center text-c-accent font-bold text-xs flex-shrink-0">
                  {displayName?.charAt(0).toUpperCase() ?? '?'}
                </div>
                {!collapsed && (
                  <div className="flex flex-col min-w-0 text-left">
                    <span className="text-sm font-semibold text-c-text-strong truncate">{displayName}</span>
                    <span className="text-[10px] text-c-text-muted">一般会員</span>
                  </div>
                )}
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center px-3 py-2 text-c-text-muted hover:text-c-text-strong hover:bg-c-surface2 transition-colors rounded-[var(--btn-radius)]"
                title="ログアウト"
              >
                <span className="material-symbols-outlined text-xl flex-shrink-0">logout</span>
                {!collapsed && <span className="ml-3 text-sm">ログアウト</span>}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => navigate('/settings')}
                className="w-full flex items-center px-3 py-2 text-c-text-muted hover:text-c-text-strong hover:bg-c-surface2 transition-colors rounded-[var(--btn-radius)]"
                title="アカウント設定"
              >
                <span className="material-symbols-outlined text-xl flex-shrink-0">account_circle</span>
                {!collapsed && <span className="ml-3 text-sm">アカウント設定</span>}
              </button>
              <button
                onClick={() => setShowLogin(true)}
                className="w-full flex items-center px-3 py-2 text-c-text-muted hover:text-c-text-strong hover:bg-c-surface2 transition-colors rounded-[var(--btn-radius)]"
                title="ログイン"
              >
                <span className="material-symbols-outlined text-xl flex-shrink-0">login</span>
                {!collapsed && <span className="ml-3 text-sm">ログイン</span>}
              </button>
            </>
          )}
        </div>
      </aside>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </>
  )
}
