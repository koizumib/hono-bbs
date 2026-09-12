import type { Board } from '../../api/types'
import BoardAvatar from '../board/BoardAvatar'

interface BoardListRowProps {
  board: Board
  isActive: boolean
  isFavorite: boolean
  onToggleFavorite: () => void
  onClick: () => void
}

// BoardSidebar (PC) と MobileBoardDrawer で共通して使う板一覧の1行。
// お気に入り星ボタンは行全体のクリック(板へ遷移)とは独立させるため、
// 内側に置いた<button>のクリックだけ伝播を止める。
export default function BoardListRow({ board, isActive, isFavorite, onToggleFavorite, onClick }: BoardListRowProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick() }}
      className={`w-full flex items-center gap-2 px-4 py-2.5 cursor-pointer text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${
        isActive ? 'active-board text-slate-900 dark:text-white' : ''
      }`}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggleFavorite() }}
        className={`flex-shrink-0 transition-colors ${isFavorite ? 'text-amber-400' : 'text-slate-400 hover:text-amber-400'}`}
        title={isFavorite ? 'お気に入りから削除' : 'お気に入りに追加'}
      >
        <span
          className="material-symbols-outlined text-lg"
          style={isFavorite ? { fontVariationSettings: "'FILL' 1" } : undefined}
        >
          {isFavorite ? 'star' : 'star_outline'}
        </span>
      </button>
      <BoardAvatar name={board.name} icon={board.icon} colorTheme={board.colorTheme} size={26} />
      <div className="flex-1 min-w-0 text-left">
        <p className="text-sm font-medium truncate">{board.name}</p>
        <p className="text-[10px] text-slate-500 font-mono truncate">{board.id} ・ {board.threadCount}スレッド</p>
      </div>
    </div>
  )
}
