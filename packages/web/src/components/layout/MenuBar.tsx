import { useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { useBoardList } from '../../hooks/useBoardList'
import { useBoards } from '../../hooks/useBoards'
import { useThreadHistoryVersionStore } from '../../stores/threadHistoryVersionStore'
import { getHistory } from '../../utils/threadHistory'
import LoginModal from '../auth/LoginModal'
import BoardAvatar from '../board/BoardAvatar'
import { env } from '../../config/env'

const HISTORY_COOKIE = 'bbs-sidebar-collapsed'
const HISTORY_LIMIT = 10

function appIconInitials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function readSidebarCookie(): boolean {
  try {
    const m = document.cookie.match(new RegExp(`${HISTORY_COOKIE}=([^;]*)`))
    return m ? m[1] !== 'true' : true
  } catch { return true }
}

function currentBoardId(pathname: string): string | undefined {
  const seg = pathname.split('/')[1]
  if (!seg || ['boards', 'settings', 'register', 'new-thread'].includes(seg)) return undefined
  return decodeURIComponent(seg)
}

/**
 * PC専用の常設メニューバー。アイコンのみのレール(閉)⇔アイコン+ラベル(開)を
 * トグルで切り替え(旧BoardSidebarと同じ挙動)、開いた状態で★/閲覧履歴ボタンを押すと
 * その場でアコーディオン展開して子要素(お気に入りの板・直近読んだスレッド)を表示する。
 * ★と閲覧履歴は互いに排他ではなく、両方同時に開いていられる。
 * 検索や板の閲覧自体はホーム画面(TopPage)側の役割なので、ここには持たない。
 */
export default function MenuBar() {
  const [expanded, setExpanded] = useState(() => readSidebarCookie())
  const [favoritesOpen, setFavoritesOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const boardId = currentBoardId(location.pathname)
  const isHome = location.pathname === '/'
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn())
  const displayName = useAuthStore((s) => s.displayName)
  const clearSession = useAuthStore((s) => s.clearSession)
  const { isLoading, favoriteBoards } = useBoardList()
  const historyVersion = useThreadHistoryVersionStore((s) => s.version)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const recentThreads = useMemo(() => getHistory().slice(0, HISTORY_LIMIT), [historyVersion])

  // 閲覧履歴の各行にどの板か分かるアバターを出すため、板一覧から board.id -> Board を引けるようにする
  const { data: boardsData } = useBoards()
  const boardsById = useMemo(
    () => new Map((boardsData?.data ?? []).map((b) => [b.id, b])),
    [boardsData],
  )

  function setExpandedPersisted(next: boolean) {
    document.cookie = `${HISTORY_COOKIE}=${!next}; path=/; max-age=${365 * 24 * 3600}; SameSite=Strict`
    setExpanded(next)
  }

  function toggleExpanded() {
    setExpandedPersisted(!expanded)
  }

  function toggleFavorites() {
    if (!expanded) setExpandedPersisted(true)
    setFavoritesOpen((prev) => !prev)
  }

  function toggleHistory() {
    if (!expanded) setExpandedPersisted(true)
    setHistoryOpen((prev) => !prev)
  }

  function goHome() {
    navigate('/')
  }

  async function handleLogout() {
    clearSession()
  }

  return (
    <>
      <aside
        className={`flex-shrink-0 border-r border-c-border bg-c-surface shadow-sm flex flex-col relative transition-all duration-300 ${
          expanded ? 'w-64' : 'w-16'
        }`}
      >
        {/* ヘッダー */}
        <div className="p-6 border-b border-c-border flex items-center justify-between">
          <button
            className="flex items-center gap-3 overflow-hidden hover:opacity-80 transition-opacity"
            onClick={goHome}
            title="トップへ戻る"
          >
            {env.appIcon ? (
              <img src={env.appIcon} alt={env.appName} className="w-8 h-8 rounded-[var(--btn-radius)] flex-shrink-0 object-contain" />
            ) : (
              <div className="w-8 h-8 bg-c-accent rounded-[var(--btn-radius)] flex-shrink-0 flex items-center justify-center font-bold text-[var(--c-accent-text)] text-sm">
                {appIconInitials(env.appName)}
              </div>
            )}
            {expanded && (
              <h1 className="menu-reveal font-bold text-lg tracking-tight truncate whitespace-nowrap text-c-text-strong">
                {env.appName}
              </h1>
            )}
          </button>
          <button
            onClick={toggleExpanded}
            className="p-1 hover:bg-c-surface2 rounded text-c-text-muted flex-shrink-0"
            title="メニューバーを切り替え"
          >
            <span className="material-symbols-outlined text-xl">
              {expanded ? 'menu_open' : 'menu'}
            </span>
          </button>
        </div>

        {/* メインナビ */}
        <nav className="flex-1 overflow-y-auto custom-scrollbar py-2">
          <button
            onClick={goHome}
            className={`w-full flex items-center gap-3 px-5 py-3 transition-colors ${
              isHome ? 'text-c-accent' : 'text-c-text-muted hover:text-c-text-body hover:bg-c-surface2'
            }`}
            title="ホーム"
          >
            <span className={`material-symbols-outlined text-xl flex-shrink-0 ${isHome ? 'fill' : ''}`}>home</span>
            {expanded && <span className="menu-reveal text-sm font-medium whitespace-nowrap">ホーム</span>}
          </button>

          {/* お気に入り */}
          <button
            onClick={toggleFavorites}
            className={`w-full flex items-center gap-3 px-5 py-3 transition-colors ${
              favoritesOpen ? 'text-c-accent' : 'text-c-text-muted hover:text-c-text-body hover:bg-c-surface2'
            }`}
            title="お気に入り"
          >
            <span className={`material-symbols-outlined text-xl flex-shrink-0 ${favoritesOpen ? 'fill' : ''}`}>star</span>
            {expanded && (
              <span className="menu-reveal flex items-center gap-3 flex-1 min-w-0">
                <span className="text-sm font-medium whitespace-nowrap flex-1 text-left">お気に入り</span>
                <span
                  className="material-symbols-outlined text-base transition-transform flex-shrink-0"
                  style={{ transform: favoritesOpen ? 'rotate(180deg)' : undefined }}
                >
                  expand_more
                </span>
              </span>
            )}
          </button>
          {expanded && favoritesOpen && (
            <div className="menu-reveal pb-2">
              {isLoading ? (
                <div className="px-8 py-2 text-xs text-c-text-muted">読み込み中...</div>
              ) : favoriteBoards.length === 0 ? (
                <div className="px-8 py-2 text-xs text-c-text-muted">お気に入りの板はありません</div>
              ) : (
                favoriteBoards.map((board) => (
                  <button
                    key={board.id}
                    onClick={() => navigate(`/${board.id}`)}
                    className={`w-full flex items-center gap-2 px-8 py-2 text-sm transition-colors ${
                      boardId === board.id ? 'text-c-accent font-medium' : 'text-c-text-body hover:bg-c-surface2'
                    }`}
                  >
                    <BoardAvatar name={board.name} icon={board.icon} colorTheme={board.colorTheme} size={20} />
                    <span className="truncate">{board.name}</span>
                  </button>
                ))
              )}
            </div>
          )}

          {/* 閲覧履歴 */}
          <button
            onClick={toggleHistory}
            className={`w-full flex items-center gap-3 px-5 py-3 transition-colors ${
              historyOpen ? 'text-c-accent' : 'text-c-text-muted hover:text-c-text-body hover:bg-c-surface2'
            }`}
            title="閲覧履歴"
          >
            <span className={`material-symbols-outlined text-xl flex-shrink-0 ${historyOpen ? 'fill' : ''}`}>schedule</span>
            {expanded && (
              <span className="menu-reveal flex items-center gap-3 flex-1 min-w-0">
                <span className="text-sm font-medium whitespace-nowrap flex-1 text-left">閲覧履歴</span>
                <span
                  className="material-symbols-outlined text-base transition-transform flex-shrink-0"
                  style={{ transform: historyOpen ? 'rotate(180deg)' : undefined }}
                >
                  expand_more
                </span>
              </span>
            )}
          </button>
          {expanded && historyOpen && (
            <div className="menu-reveal pb-2">
              {recentThreads.length === 0 ? (
                <div className="px-8 py-2 text-xs text-c-text-muted">閲覧履歴はありません</div>
              ) : (
                recentThreads.map((entry) => {
                  const board = boardsById.get(entry.boardId)
                  return (
                    <button
                      key={entry.threadId}
                      onClick={() => navigate(`/${entry.boardId}/${entry.threadId}`)}
                      className="w-full flex items-center gap-2 px-8 py-2 hover:bg-c-surface2 transition-colors min-w-0"
                    >
                      <BoardAvatar name={board?.name ?? entry.boardName} icon={board?.icon} colorTheme={board?.colorTheme} size={20} />
                      <span className="min-w-0 text-left">
                        <p className="text-sm text-c-text-body truncate">{entry.threadTitle}</p>
                        <p className="text-[10px] text-c-text-muted truncate">{entry.boardName}</p>
                      </span>
                    </button>
                  )
                })
              )}
              <button
                onClick={() => navigate('/settings?tab=history')}
                className="w-full text-left px-8 py-2 text-xs text-c-accent hover:underline"
              >
                その他の閲覧履歴
              </button>
            </div>
          )}
        </nav>

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
                {expanded && (
                  <div className="menu-reveal flex flex-col min-w-0 text-left">
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
                {expanded && <span className="menu-reveal ml-3 text-sm">ログアウト</span>}
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
                {expanded && <span className="menu-reveal ml-3 text-sm">アカウント設定</span>}
              </button>
              <button
                onClick={() => setShowLogin(true)}
                className="w-full flex items-center px-3 py-2 text-c-text-muted hover:text-c-text-strong hover:bg-c-surface2 transition-colors rounded-[var(--btn-radius)]"
                title="ログイン"
              >
                <span className="material-symbols-outlined text-xl flex-shrink-0">login</span>
                {expanded && <span className="menu-reveal ml-3 text-sm">ログイン</span>}
              </button>
            </>
          )}
        </div>
      </aside>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </>
  )
}
