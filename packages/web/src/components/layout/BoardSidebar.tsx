import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useBoards } from '../../hooks/useBoards'
import { useAuthStore } from '../../stores/authStore'
import { useSettingsStore } from '../../stores/settingsStore'
import LoginModal from '../auth/LoginModal'
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
  const { data, isLoading } = useBoards()
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn())
  const displayName = useAuthStore((s) => s.displayName)
  const clearSession = useAuthStore((s) => s.clearSession)
  const hiddenBoardIds = useSettingsStore((s) => s.hiddenBoardIds)

  const boards = (data?.data ?? []).filter((b) => !hiddenBoardIds.includes(b.id))

  async function handleLogout() {
    clearSession()
  }

  return (
    <>
      <aside
        className={`flex-shrink-0 border-r border-c-border bg-c-surface flex flex-col relative transition-all duration-300 ${
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
              <img src={env.appIcon} alt={env.appName} className="w-8 h-8 rounded-lg flex-shrink-0 object-contain" />
            ) : (
              <div className="w-8 h-8 bg-c-accent rounded-lg flex-shrink-0 flex items-center justify-center font-bold text-[var(--c-accent-text)] text-sm">
                {appIconInitials(env.appName)}
              </div>
            )}
            {!collapsed && (
              <h1 className="font-bold text-lg tracking-tight truncate whitespace-nowrap text-slate-900 dark:text-white">
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
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 dark:text-slate-400 flex-shrink-0"
            title="サイドバーを切り替え"
          >
            <span className="material-symbols-outlined text-xl">
              {collapsed ? 'menu' : 'menu_open'}
            </span>
          </button>
        </div>

        {/* 板一覧 */}
        <nav className="flex-1 overflow-y-auto custom-scrollbar py-4">
          {!collapsed && (
            <div className="px-4 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              板一覧
            </div>
          )}
          {isLoading ? (
            <div className="px-5 py-3 text-slate-500 text-sm">読み込み中...</div>
          ) : (
            <ul className="space-y-1">
              {boards.map((board) => (
                <li key={board.id}>
                  <button
                    onClick={() => navigate(`/${board.id}`)}
                    className={`w-full flex items-center px-5 py-3 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${
                      boardId === board.id ? 'active-board text-slate-900 dark:text-white' : ''
                    }`}
                    title={board.name}
                  >
                    <span className="material-symbols-outlined text-xl flex-shrink-0">
                      terminal
                    </span>
                    {!collapsed && (
                      <span className="ml-3 text-sm font-medium whitespace-nowrap truncate">
                        {board.name}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </nav>

        {/* フッター */}
        <div className="border-t border-c-border p-2 space-y-1">
          {isLoggedIn ? (
            <>
              <button
                onClick={() => navigate('/settings')}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors rounded-lg"
                title={displayName ?? 'ユーザー情報'}
              >
                <div className="w-7 h-7 rounded-full bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-blue-400 font-bold text-xs flex-shrink-0">
                  {displayName?.charAt(0).toUpperCase() ?? '?'}
                </div>
                {!collapsed && (
                  <div className="flex flex-col min-w-0 text-left">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">{displayName}</span>
                    <span className="text-[10px] text-slate-500">一般会員</span>
                  </div>
                )}
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center px-3 py-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors rounded-lg"
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
                className="w-full flex items-center px-3 py-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors rounded-lg"
                title="アカウント設定"
              >
                <span className="material-symbols-outlined text-xl flex-shrink-0">account_circle</span>
                {!collapsed && <span className="ml-3 text-sm">アカウント設定</span>}
              </button>
              <button
                onClick={() => setShowLogin(true)}
                className="w-full flex items-center px-3 py-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors rounded-lg"
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
