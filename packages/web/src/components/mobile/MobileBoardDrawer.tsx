import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
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

interface MobileBoardDrawerProps {
  isOpen: boolean
  onClose: () => void
  currentBoardId?: string
}

/**
 * モバイル用左スワイプドロワー。板一覧を表示する。
 */
export default function MobileBoardDrawer({
  isOpen,
  onClose,
  currentBoardId,
}: MobileBoardDrawerProps) {
  const navigate = useNavigate()
  const { data, isLoading } = useBoards()
  const hiddenBoardIds = useSettingsStore((s) => s.hiddenBoardIds)
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn())
  const displayName = useAuthStore((s) => s.displayName)
  const clearSession = useAuthStore((s) => s.clearSession)
  const [showLogin, setShowLogin] = useState(false)

  const boards = (data?.data ?? []).filter((b) => !hiddenBoardIds.includes(b.id))

  function handleBoardClick(boardId: string) {
    navigate(`/${boardId}`)
    onClose()
  }

  const portal = createPortal(
    <div
      className="fixed inset-0 z-[9500]"
      style={{ pointerEvents: isOpen ? 'auto' : 'none' }}
    >
      {/* バックドロップ */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity duration-250"
        style={{ opacity: isOpen ? 1 : 0 }}
        onClick={onClose}
      />

      {/* ドロワー本体 */}
      <div
        className="absolute left-0 top-0 bottom-0 w-72 bg-c-surface flex flex-col shadow-2xl"
        style={{
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 250ms cubic-bezier(0.32, 0.72, 0, 1)',
          willChange: 'transform',
        }}
      >
        {/* ヘッダー */}
        <div className="h-14 flex items-center px-4 gap-3 border-b border-c-border flex-shrink-0">
          <button
            className="flex-shrink-0"
            onClick={() => { navigate('/'); onClose() }}
          >
            {env.appIcon ? (
              <img src={env.appIcon} alt={env.appName} className="w-8 h-8 rounded-lg object-contain" />
            ) : (
              <div className="w-8 h-8 bg-c-accent rounded-lg flex items-center justify-center font-bold text-[var(--c-accent-text)] text-sm">
                {appIconInitials(env.appName)}
              </div>
            )}
          </button>
          <span className="font-bold text-slate-900 dark:text-white">{env.appName}</span>
        </div>

        {/* 板一覧 */}
        <nav className="flex-1 overflow-y-auto custom-scrollbar py-2">
          <div className="px-4 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            板一覧
          </div>
          {isLoading ? (
            <div className="px-5 py-3 text-slate-500 text-sm">読み込み中...</div>
          ) : (
            <ul>
              {boards.map((board) => (
                <li key={board.id}>
                  <button
                    onClick={() => handleBoardClick(board.id)}
                    className={`w-full flex items-center px-4 py-3 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${
                      currentBoardId === board.id ? 'active-board text-slate-900 dark:text-white' : ''
                    }`}
                  >
                    <span className="material-symbols-outlined text-xl flex-shrink-0">terminal</span>
                    <span className="ml-3 text-sm font-medium truncate">{board.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </nav>

        {/* フッター */}
        <div className="border-t border-c-border p-2 space-y-1 flex-shrink-0">
          <button
            onClick={() => { navigate('/settings'); onClose() }}
            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors rounded-lg"
          >
            {isLoggedIn ? (
              <div className="w-7 h-7 rounded-full bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-blue-400 font-bold text-xs flex-shrink-0">
                {displayName?.charAt(0).toUpperCase() ?? '?'}
              </div>
            ) : (
              <span className="material-symbols-outlined text-xl text-slate-400 flex-shrink-0">
                account_circle
              </span>
            )}
            <span className="text-sm text-slate-700 dark:text-slate-300">
              {isLoggedIn ? displayName : 'アカウント設定'}
            </span>
          </button>
          {isLoggedIn ? (
            <button
              onClick={() => { clearSession(); onClose() }}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-red-500/10 transition-colors rounded-lg"
            >
              <span className="material-symbols-outlined text-xl text-red-400 flex-shrink-0">logout</span>
              <span className="text-sm text-red-400">ログアウト</span>
            </button>
          ) : (
            <button
              onClick={() => setShowLogin(true)}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors rounded-lg"
            >
              <span className="material-symbols-outlined text-xl text-slate-400 flex-shrink-0">login</span>
              <span className="text-sm text-slate-700 dark:text-slate-300">ログイン</span>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
  return (
    <>
      {portal}
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </>
  )
}

