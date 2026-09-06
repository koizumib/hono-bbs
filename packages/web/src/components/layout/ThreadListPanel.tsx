import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useThreads } from '../../hooks/useThreads'
import { useSettingsStore } from '../../stores/settingsStore'
import { filterThreads } from '../../utils/filter'
import ThreadCard from '../thread/ThreadCard'
import { useDragResize } from '../../hooks/useDragResize'
import { getHistory, removeThreadFromHistory } from '../../utils/threadHistory'
import { fuzzyMatch } from '../../utils/fuzzySearch'

export default function ThreadListPanel() {
  const { boardId, threadId } = useParams()
  const navigate = useNavigate()
  const { data, isLoading, refetch } = useThreads(boardId)
  const ngWords = useSettingsStore((s) => s.ngWords)
  const threadListAutoRefresh = useSettingsStore((s) => s.threadListAutoRefresh)
  const threadListRefreshInterval = useSettingsStore((s) => s.threadListRefreshInterval)

  const [sortMode, setSortMode] = useState<'default' | 'momentum' | 'newest'>('default')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [historyVersion, setHistoryVersion] = useState(0)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const lastClickedIdRef = useRef<string | null>(null)
  const lastRefreshRef = useRef(0)

  const board = data?.data.board
  const rawThreads = data?.data.threads ?? []
  const baseThreads = filterThreads(rawThreads, ngWords)

  const history = useMemo(() => getHistory(), [historyVersion])
  const readMap = useMemo(() => new Map(history.map(e => [e.threadId, e.lastReadCount])), [history])

  let threads = [...baseThreads]

  if (unreadOnly) {
    threads = threads.filter(t => readMap.has(t.id) && (readMap.get(t.id) ?? 0) < t.postCount)
  }

  if (sortMode === 'momentum') {
    threads = threads.slice().sort((a, b) => {
      const ma = a.postCount / Math.max(1, (Date.now() - new Date(a.firstPost?.createdAt ?? a.createdAt).getTime()) / 86400000)
      const mb = b.postCount / Math.max(1, (Date.now() - new Date(b.firstPost?.createdAt ?? b.createdAt).getTime()) / 86400000)
      return mb - ma
    })
  } else if (sortMode === 'newest') {
    threads = threads.slice().sort((a, b) => {
      const da = new Date(a.firstPost?.createdAt ?? a.createdAt).getTime()
      const db = new Date(b.firstPost?.createdAt ?? b.createdAt).getTime()
      return db - da
    })
  }

  if (searchQuery.trim()) {
    threads = threads.filter(t => fuzzyMatch(t.title, searchQuery))
  }

  // F5 / Ctrl+R でスレッド一覧を更新（5秒クールダウン）
  const handleRefresh = useCallback(() => {
    const now = Date.now()
    if (now - lastRefreshRef.current < 5000) return
    lastRefreshRef.current = now
    void refetch()
  }, [refetch])

  function handleWheelRefresh(e: React.WheelEvent<HTMLDivElement>) {
    if (e.deltaY < 0 && e.currentTarget.scrollTop < 1) handleRefresh()
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key === 'r')) {
        e.preventDefault()
        handleRefresh()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleRefresh])

  // 自動更新
  useEffect(() => {
    if (!boardId || !threadListAutoRefresh) return
    const ms = Math.max(5, threadListRefreshInterval) * 1000
    const id = setInterval(() => { void refetch() }, ms)
    return () => clearInterval(id)
  }, [boardId, threadListAutoRefresh, threadListRefreshInterval, refetch])

  // Delete キー: 複数選択中→選択を全削除、未選択→表示中スレッドを削除して閉じる
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Delete') return
      if (selectedIds.size > 0) {
        selectedIds.forEach(id => removeThreadFromHistory(id))
        const wasViewingSelected = threadId != null && selectedIds.has(threadId)
        setSelectedIds(new Set())
        setHistoryVersion(v => v + 1)
        if (wasViewingSelected && boardId) navigate(`/${boardId}`)
      } else if (threadId && boardId) {
        removeThreadFromHistory(threadId)
        setHistoryVersion(v => v + 1)
        navigate(`/${boardId}`)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [threadId, boardId, selectedIds, navigate])

  function handleThreadClick(id: string, e: React.MouseEvent) {
    if (e.ctrlKey || e.metaKey) {
      // Ctrl+クリック: トグル選択（スレッド表示は更新しない）
      e.preventDefault()
      setSelectedIds(prev => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
      lastClickedIdRef.current = id
    } else if (e.shiftKey && lastClickedIdRef.current) {
      // Shift+クリック: 範囲選択（スレッド表示は更新しない）
      e.preventDefault()
      const lastIdx = threads.findIndex(t => t.id === lastClickedIdRef.current)
      const currIdx = threads.findIndex(t => t.id === id)
      if (lastIdx !== -1 && currIdx !== -1) {
        const from = Math.min(lastIdx, currIdx)
        const to = Math.max(lastIdx, currIdx)
        setSelectedIds(new Set(threads.slice(from, to + 1).map(t => t.id)))
      }
    } else {
      // 通常クリック: 選択解除してスレッド表示
      setSelectedIds(new Set())
      lastClickedIdRef.current = id
      navigate(`/${boardId}/${id}`)
    }
  }

  const { size: panelWidth, onMouseDown } = useDragResize({
    storageKey: 'bbs-thread-list-width',
    defaultSize: 320,
    direction: 'horizontal',
    min: 160,
    max: 600,
  })

  return (
    <section
      style={{ width: panelWidth }}
      className="flex-shrink-0 border-r border-c-border bg-c-base flex flex-col relative"
    >
      {/* 右端ドラッグハンドル */}
      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-c-accent/30 transition-colors z-10"
        onMouseDown={onMouseDown}
      />

      <div className="p-4 border-b border-c-border space-y-4">
        <div className="flex flex-col gap-2">
          <h2 className="font-bold text-slate-900 dark:text-white text-lg">
            {board ? board.name : boardId ? '読み込み中...' : '板を選択'}
          </h2>
          {boardId && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="スレッド検索..."
                className="flex-1 bg-c-surface2 border border-c-border rounded-lg px-2 py-1 text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-c-accent/50 min-w-0"
              />
              <button
                type="button"
                onClick={handleRefresh}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors rounded-lg flex-shrink-0"
                title="スレッド一覧を更新"
              >
                <span className="material-symbols-outlined text-lg">refresh</span>
              </button>
            </div>
          )}
        </div>
        {boardId && (
          <button
            onClick={() => navigate(`/new-thread/${boardId}`)}
            className="w-full bg-c-accent hover:opacity-90 text-[var(--c-accent-text)] font-medium py-2 px-4 rounded-lg transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">add_comment</span>
            新規スレッド作成
          </button>
        )}
      </div>

      <div className="flex gap-1 px-3 py-2 border-b border-c-border bg-c-surface/50">
        <button
          type="button"
          onClick={() => setUnreadOnly(!unreadOnly)}
          className={`flex-1 py-1 text-[10px] font-bold rounded-lg transition-colors ${unreadOnly ? 'bg-c-accent text-[var(--c-accent-text)]' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 bg-slate-100 dark:bg-slate-800'}`}
        >未読</button>
        <button
          type="button"
          onClick={() => setSortMode(sortMode === 'momentum' ? 'default' : 'momentum')}
          className={`flex-1 py-1 text-[10px] font-bold rounded-lg transition-colors ${sortMode === 'momentum' ? 'bg-c-accent text-[var(--c-accent-text)]' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 bg-slate-100 dark:bg-slate-800'}`}
        >勢い順</button>
        <button
          type="button"
          onClick={() => setSortMode(sortMode === 'newest' ? 'default' : 'newest')}
          className={`flex-1 py-1 text-[10px] font-bold rounded-lg transition-colors ${sortMode === 'newest' ? 'bg-c-accent text-[var(--c-accent-text)]' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 bg-slate-100 dark:bg-slate-800'}`}
        >新しい順</button>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-c-accent/10 border-b border-c-accent/20 flex-shrink-0">
          <span className="text-[10px] text-c-accent font-bold flex-1">{selectedIds.size}件選択中</span>
          <button
            type="button"
            onClick={() => {
              selectedIds.forEach(id => removeThreadFromHistory(id))
              const wasViewingSelected = threadId != null && selectedIds.has(threadId)
              setSelectedIds(new Set())
              setHistoryVersion(v => v + 1)
              if (wasViewingSelected && boardId) navigate(`/${boardId}`)
            }}
            className="text-[10px] text-red-400 hover:text-red-300 font-bold flex items-center gap-0.5"
          >
            <span className="material-symbols-outlined text-sm">delete</span>
            履歴削除
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="text-[10px] text-slate-400 hover:text-slate-300"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto custom-scrollbar" onWheel={handleWheelRefresh}>
        {!boardId ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            左のサイドバーから板を選択してください
          </div>
        ) : isLoading ? (
          <div className="p-8 text-center text-slate-500 text-sm">読み込み中...</div>
        ) : threads.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">スレッドがありません</div>
        ) : (
          threads.map((thread) => (
            <ThreadCard
              key={thread.id}
              thread={thread}
              isActive={threadId === thread.id}
              isSelected={selectedIds.has(thread.id)}
              onClick={(e) => handleThreadClick(thread.id, e)}
            />
          ))
        )}
      </div>
    </section>
  )
}
