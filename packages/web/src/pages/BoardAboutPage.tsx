import { useParams, useNavigate } from 'react-router-dom'
import { useBoard } from '../hooks/useBoard'
import { useSettingsStore } from '../stores/settingsStore'

export default function BoardAboutPage() {
  const { boardId } = useParams()
  const navigate = useNavigate()
  const { data, isLoading, isError } = useBoard(boardId)
  const favoriteBoardIds = useSettingsStore((s) => s.favoriteBoardIds)
  const toggleFavoriteBoard = useSettingsStore((s) => s.toggleFavoriteBoard)

  const board = data?.data
  const isFavorite = boardId ? favoriteBoardIds.includes(boardId) : false

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-c-base text-c-text-body">
      <header className="flex-shrink-0 border-b border-c-border bg-c-surface px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <button
            onClick={() => navigate('/boards')}
            className="p-1.5 -ml-1.5 text-c-text-muted hover:text-c-text-body rounded-[var(--btn-radius)] hover:bg-c-surface2 transition-colors flex-shrink-0"
            title="板検索へ戻る"
          >
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </button>
          <h1 className="font-bold text-base truncate">板の紹介</h1>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-2xl mx-auto p-6">
          {isLoading ? (
            <div className="text-center text-c-text-muted text-sm py-8">読み込み中...</div>
          ) : isError || !board ? (
            <div className="text-center text-c-text-muted text-sm py-8">板が見つかりませんでした</div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-c-text-strong truncate">{board.name}</h2>
                  <p className="text-xs font-mono text-c-text-muted mt-1">{board.id}</p>
                </div>
                <button
                  onClick={() => toggleFavoriteBoard(board.id)}
                  className={`flex-shrink-0 p-2 rounded-[var(--btn-radius)] transition-colors ${
                    isFavorite ? 'text-amber-400' : 'text-c-text-muted hover:text-amber-400'
                  }`}
                  title={isFavorite ? 'お気に入りから削除' : 'お気に入りに追加'}
                >
                  <span
                    className="material-symbols-outlined text-2xl"
                    style={isFavorite ? { fontVariationSettings: "'FILL' 1" } : undefined}
                  >
                    {isFavorite ? 'star' : 'star_outline'}
                  </span>
                </button>
              </div>

              <div className="flex items-center gap-4 mt-4 text-sm text-c-text-muted">
                {board.category && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium border border-c-border">
                    {board.category}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-base leading-none">forum</span>
                  {board.threadCount}スレッド
                </span>
              </div>

              {board.description && (
                <p className="mt-6 text-sm text-c-text-body whitespace-pre-wrap leading-relaxed">
                  {board.description}
                </p>
              )}

              <button
                onClick={() => navigate(`/${board.id}`)}
                className="mt-8 w-full py-3 rounded-[var(--btn-radius)] font-bold text-sm bg-c-accent text-[var(--c-accent-text)] hover:opacity-90 transition-opacity"
              >
                この板に入る
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
