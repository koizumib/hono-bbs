import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useBoards } from '../hooks/useBoards'
import { useBoardSearch } from '../hooks/useBoardSearch'
import { useSettingsStore } from '../stores/settingsStore'
import BoardListRow from '../components/layout/BoardListRow'

const UNCATEGORIZED = 'その他'

export default function BoardSearchPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const favoriteBoardIds = useSettingsStore((s) => s.favoriteBoardIds)
  const toggleFavoriteBoard = useSettingsStore((s) => s.toggleFavoriteBoard)

  // q/sort/category はURLを情報源にする(直接リンク・戻る/進むでも状態が保たれるように)
  const debouncedQuery = (searchParams.get('q') ?? '').trim()
  const sort: 'newest' | 'popular' = searchParams.get('sort') === 'popular' ? 'popular' : 'newest'
  const category = searchParams.get('category') ?? ''

  function setSort(next: 'newest' | 'popular') {
    const p = new URLSearchParams(searchParams)
    if (next === 'popular') p.set('sort', 'popular')
    else p.delete('sort')
    setSearchParams(p, { replace: true })
  }

  function setCategory(next: string) {
    const p = new URLSearchParams(searchParams)
    if (next) p.set('category', next)
    else p.delete('category')
    setSearchParams(p, { replace: true })
  }

  // 検索欄はこのページ自身が持つ(300msデバウンスしてからURLのqへ反映)
  const [inputQuery, setInputQuery] = useState(debouncedQuery)
  useEffect(() => {
    const t = setTimeout(() => {
      const p = new URLSearchParams(searchParams)
      if (inputQuery.trim()) p.set('q', inputQuery.trim())
      else p.delete('q')
      setSearchParams(p, { replace: true })
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputQuery])

  // カテゴリ絞り込みチップ用に、全板の一覧からカテゴリ一覧を洗い出す
  // (検索結果側は絞り込み後の板しか含まないため、チップの選択肢はこちらから作る)
  const { data: allBoardsData } = useBoards()
  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const b of allBoardsData?.data ?? []) {
      set.add(b.category?.trim() || UNCATEGORIZED)
    }
    return Array.from(set).sort()
  }, [allBoardsData])

  const { data, isLoading } = useBoardSearch(debouncedQuery, category === UNCATEGORIZED ? '' : category, sort)
  const boards = useMemo(() => {
    const items = data?.data ?? []
    if (category !== UNCATEGORIZED) return items
    return items.filter((b) => !b.category?.trim())
  }, [data, category])

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-c-base text-c-text-body">
      <header className="flex-shrink-0 border-b border-c-border bg-c-surface px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <button
            onClick={() => navigate('/')}
            className="p-1.5 -ml-1.5 text-c-text-muted hover:text-c-text-body rounded-[var(--btn-radius)] hover:bg-c-surface2 transition-colors flex-shrink-0"
            title="トップへ戻る"
          >
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </button>
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-c-text-muted text-lg pointer-events-none">
              search
            </span>
            <input
              type="text"
              autoFocus
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="板名・IDで検索..."
              className="w-full bg-c-surface2 border border-c-border rounded-[var(--btn-radius)] pl-9 pr-3 py-2 text-sm text-c-text-body placeholder-c-text-muted focus:outline-none focus:ring-1 focus:ring-c-accent/50"
            />
          </div>
        </div>
      </header>

      <div className="flex-shrink-0 border-b border-c-border bg-c-surface/50 max-w-2xl w-full mx-auto">
        {/* 並び替えタブ */}
        <div className="flex text-sm">
          <button
            onClick={() => setSort('newest')}
            className={`flex-1 py-2.5 font-medium border-b-2 transition-colors ${
              sort === 'newest' ? 'border-c-accent text-c-accent' : 'border-transparent text-c-text-muted hover:text-c-text-body'
            }`}
          >
            新着
          </button>
          <button
            onClick={() => setSort('popular')}
            className={`flex-1 py-2.5 font-medium border-b-2 transition-colors ${
              sort === 'popular' ? 'border-c-accent text-c-accent' : 'border-transparent text-c-text-muted hover:text-c-text-body'
            }`}
          >
            人気
          </button>
        </div>
        {/* カテゴリ絞り込みチップ */}
        {categories.length > 0 && (
          <div className="flex gap-1.5 px-4 py-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setCategory('')}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                category === '' ? 'bg-c-accent text-[var(--c-accent-text)] border-c-accent' : 'border-c-border text-c-text-muted hover:text-c-text-body'
              }`}
            >
              すべて
            </button>
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
                  category === c ? 'bg-c-accent text-[var(--c-accent-text)] border-c-accent' : 'border-c-border text-c-text-muted hover:text-c-text-body'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar max-w-2xl w-full mx-auto">
        {isLoading ? (
          <div className="px-5 py-8 text-center text-c-text-muted text-sm">読み込み中...</div>
        ) : boards.length === 0 ? (
          <div className="px-5 py-8 text-center text-c-text-muted text-sm">該当する板がありません</div>
        ) : (
          boards.map((board) => (
            <BoardListRow
              key={board.id}
              board={board}
              isActive={false}
              isFavorite={favoriteBoardIds.includes(board.id)}
              onToggleFavorite={() => toggleFavoriteBoard(board.id)}
              onClick={() => navigate(`/${board.id}/about`)}
            />
          ))
        )}
      </div>
    </div>
  )
}
