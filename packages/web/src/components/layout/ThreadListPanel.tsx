import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useThreads } from '../../hooks/useThreads'
import { useSettingsStore } from '../../stores/settingsStore'
import { filterThreads } from '../../utils/filter'
import ThreadCard from '../thread/ThreadCard'
import NgHiddenNotice from '../ui/NgHiddenNotice'
import { useDragResize } from '../../hooks/useDragResize'
import { getHistory, forgetThread } from '../../utils/threadHistory'
import { recordBoardView } from '../../utils/boardHistory'
import { fuzzyMatch } from '../../utils/fuzzySearch'
import { cycleSort, type SortState } from '../../utils/sortCycle'
import { useNewIdsFlash } from '../../hooks/useNewIdsFlash'
import { calculateMomentum, rankMomentum } from '../../utils/momentum'
import { useThreadHistoryVersionStore } from '../../stores/threadHistoryVersionStore'
import { useWheelPullRefresh } from '../../hooks/useWheelPullRefresh'
import PullSpinner from '../ui/PullSpinner'
import { PULL_HIDDEN_Y } from '../../utils/pullRefresh'

type SortMode = 'momentum' | 'newest'

export default function ThreadListPanel() {
  const { boardId, threadId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data, isLoading, isError, refetch, dataUpdatedAt } = useThreads(boardId)
  const ngRules = useSettingsStore((s) => s.ngRules)
  const threadListAutoRefresh = useSettingsStore((s) => s.threadListAutoRefresh)
  const threadListRefreshInterval = useSettingsStore((s) => s.threadListRefreshInterval)

  const [sortState, setSortState] = useState<SortState<SortMode> | null>(null)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  // スレッド表示画面で新着レスを取得した際にも自動で再計算されるよう、
  // ローカルstateではなく共有ストアの更新カウンタを使う
  const historyVersion = useThreadHistoryVersionStore((s) => s.version)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isRefreshing, setIsRefreshing] = useState(false)
  const lastClickedIdRef = useRef<string | null>(null)
  const lastRefreshRef = useRef(0)

  useEffect(() => {
    if (boardId) recordBoardView(boardId)
  }, [boardId])

  const board = data?.data.board
  const rawThreads = data?.data.threads ?? []
  const baseThreads = filterThreads(rawThreads, ngRules)
  // 勢いは板ごとの相対順位で色付けする(過疎板でも一番勢いがあるスレは赤くなるように)。
  // NGワードで隠されている分は除いた、この板で実際に見えるスレッド全体を母集団にする
  const momentumRankMap = useMemo(() => rankMomentum(baseThreads), [baseThreads])

  const history = useMemo(() => getHistory(), [historyVersion])
  const readMap = useMemo(() => new Map(history.map(e => [e.threadId, e.lastReadCount])), [history])

  let threads = [...baseThreads]

  if (unreadOnly) {
    threads = threads.filter(t => readMap.has(t.id) && (readMap.get(t.id) ?? 0) < t.postCount)
  }

  if (sortState?.mode === 'momentum') {
    const sign = sortState.dir === 'asc' ? 1 : -1
    // ThreadCardの炎アイコンと同じ計算式(calculateMomentum)を使う
    threads = threads.slice().sort((a, b) => (calculateMomentum(a) - calculateMomentum(b)) * sign)
  } else if (sortState?.mode === 'newest') {
    const sign = sortState.dir === 'asc' ? 1 : -1
    threads = threads.slice().sort((a, b) => {
      const da = new Date(a.firstPost?.createdAt ?? a.createdAt).getTime()
      const db = new Date(b.firstPost?.createdAt ?? b.createdAt).getTime()
      return (da - db) * sign
    })
  }

  if (searchQuery.trim()) {
    threads = threads.filter(t => fuzzyMatch(t.title, searchQuery))
  }

  // 更新で新しく取得できたスレッドを描画時に一瞬光らせる。
  // フィルタ/ソート後のthreadsを渡すと、未読フィルタのON/OFFや並び替えで
  // 「表示から一時的に消えていただけ」のスレッドまで新着扱いされてしまう
  // (再表示のたびにほぼ全件が誤って光るバグの原因だった)。サーバーから
  // 取得した生データ(rawThreads)を渡し、UI操作では変化しない基準にする。
  // (useNewIdsFlash内部でids配列をjoinして安定した依存値にしているので、ここではメモ化不要)
  // enabled: !isLoadingを渡さないと、ローディング中の一時的な空配列を「初回の基準」として
  // 記録した直後に本物のデータが届き、全件が新着と誤検知されてしまう
  // (ブラウザリロード時に全スレッドが光る不具合の原因だった)。
  const { newSinceLastLoad: newThreadIdsRaw, flashingNow } = useNewIdsFlash(rawThreads.map((t) => t.id), dataUpdatedAt, boardId, undefined, !isLoading)

  // 新着スレッドをクリックして開いたら、そのスレッドの新着ドットは消す
  // (次に一覧を再取得するまで待たせる必要はない)
  const [dismissedNewIds, setDismissedNewIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (!threadId || !newThreadIdsRaw.has(threadId) || dismissedNewIds.has(threadId)) return
    setDismissedNewIds((prev) => new Set(prev).add(threadId))
  }, [threadId, newThreadIdsRaw, dismissedNewIds])
  const newThreadIds = useMemo(() => {
    if (dismissedNewIds.size === 0) return newThreadIdsRaw
    const result = new Set(newThreadIdsRaw)
    for (const id of dismissedNewIds) result.delete(id)
    return result
  }, [newThreadIdsRaw, dismissedNewIds])

  // F5 / Ctrl+R でスレッド一覧を更新。
  // 以前は5秒クールダウンを設けていたが、その間の再クリック/再押下は何のフィードバックも
  // 無いまま黙って無視されていた(「新着スレッドのドットが消えない」不具合の実際の原因は
  // useNewIdsFlash側ではなくこれで、単に再取得自体が起きていなかった)。連打防止は
  // isRefreshing中のボタンdisabledで十分なので、時間ベースの間引きは短い値に留める。
  const handleRefresh = useCallback(async () => {
    const now = Date.now()
    if (now - lastRefreshRef.current < 500) return
    lastRefreshRef.current = now
    setIsRefreshing(true)
    try {
      await refetch()
    } finally {
      setIsRefreshing(false)
    }
  }, [refetch])

  // PC版: マウスホイールでの引っ張り更新（スマホのタッチ版と同じ丸矢印アニメーション）。
  // 1回のホイールイベントで即座に更新されないよう、閾値まで複数回分を累積させる
  // (だいたいスクロール3回分に相当する量)。
  const {
    indicatorRef: listPullIndicatorRef,
    iconRef: listPullIconRef,
    pull: listPull,
    reset: listPullReset,
  } = useWheelPullRefresh({ onRefresh: handleRefresh, sign: 1 })

  function handleWheelRefresh(e: React.WheelEvent<HTMLDivElement>) {
    if (e.deltaY < 0 && e.currentTarget.scrollTop < 1) {
      listPull(-e.deltaY)
    } else {
      listPullReset()
    }
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
        if (boardId) selectedIds.forEach(id => forgetThread(queryClient, boardId, id))
        const wasViewingSelected = threadId != null && selectedIds.has(threadId)
        setSelectedIds(new Set())
        if (wasViewingSelected && boardId) navigate(`/${boardId}`)
      } else if (threadId && boardId) {
        forgetThread(queryClient, boardId, threadId)
        navigate(`/${boardId}`)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [threadId, boardId, selectedIds, navigate, queryClient])

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
      if (id === threadId) {
        // 既に表示中のスレッドを再度クリックした場合はnavigateが実質no-opになるため、
        // 代わりにそのスレッドの投稿一覧を明示的に再取得して新着レスを反映する
        void queryClient.refetchQueries({ queryKey: ['posts', boardId, id] })
      } else {
        navigate(`/${boardId}/${id}`)
      }
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
                disabled={isRefreshing}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors rounded-lg flex-shrink-0"
                title="スレッド一覧を更新"
              >
                <span className={`material-symbols-outlined text-lg${isRefreshing ? ' animate-spin' : ''}`}>refresh</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 px-4 border-b border-c-border bg-c-surface/50 text-sm font-medium">
        <button
          type="button"
          onClick={() => setUnreadOnly(!unreadOnly)}
          className={`relative py-2.5 transition-colors ${unreadOnly ? 'text-c-accent' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
        >
          未読
          {unreadOnly && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-c-accent rounded-full" />}
        </button>
        {([
          { mode: 'momentum' as const, label: '勢い順' },
          { mode: 'newest' as const, label: '新しい順' },
        ]).map(({ mode, label }) => {
          const active = sortState?.mode === mode
          return (
            <button
              key={mode}
              type="button"
              onClick={() => setSortState((s) => cycleSort(s, mode))}
              className={`relative py-2.5 flex items-center gap-0.5 transition-colors ${active ? 'text-c-accent' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              {label}
              <span className={`material-symbols-outlined text-sm leading-none ${active ? '' : 'invisible'}`}>
                {active && sortState.dir === 'desc' ? 'arrow_downward' : 'arrow_upward'}
              </span>
              {active && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-c-accent rounded-full" />}
            </button>
          )
        })}
      </div>

      <NgHiddenNotice count={rawThreads.length - baseThreads.length} />

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-c-accent/10 border-b border-c-accent/20 flex-shrink-0">
          <span className="text-[10px] text-c-accent font-bold flex-1">{selectedIds.size}件選択中</span>
          <button
            type="button"
            onClick={() => {
              if (boardId) selectedIds.forEach(id => forgetThread(queryClient, boardId, id))
              const wasViewingSelected = threadId != null && selectedIds.has(threadId)
              setSelectedIds(new Set())
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

      <div className="flex-1 relative overflow-hidden">
        <div
          className="absolute left-0 right-0 top-0 flex justify-center pointer-events-none z-10"
          style={{ opacity: 0, transform: `translateY(${PULL_HIDDEN_Y}px)` }}
          ref={listPullIndicatorRef}
        >
          <PullSpinner iconRef={listPullIconRef} />
        </div>
      <div className="h-full overflow-y-auto custom-scrollbar" onWheel={handleWheelRefresh}>
        {!boardId ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            左のサイドバーから板を選択してください
          </div>
        ) : isError ? (
          <div className="p-8 text-center text-slate-500 text-sm">データが取得できませんでした</div>
        ) : isLoading ? (
          <div className="p-8 text-center text-slate-500 text-sm">読み込み中...</div>
        ) : threads.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">スレッドがありません</div>
        ) : (
          <div className="p-2 flex flex-col gap-1.5">
          {threads.map((thread) => (
            <ThreadCard
              key={thread.id}
              thread={thread}
              isActive={threadId === thread.id}
              isSelected={selectedIds.has(thread.id)}
              isNew={newThreadIds.has(thread.id)}
              flash={flashingNow.has(thread.id)}
              momentumRank={momentumRankMap.get(thread.id) ?? 0}
              onClick={(e) => handleThreadClick(thread.id, e)}
            />
          ))}
          </div>
        )}
      </div>
      </div>

      {boardId && (
        <div className="p-3 border-t border-c-border flex-shrink-0">
          <button
            onClick={() => navigate(`/new-thread/${boardId}`)}
            className="w-full bg-c-accent hover:opacity-90 text-[var(--c-accent-text)] font-medium py-2 px-4 rounded-lg transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">add_comment</span>
            新規スレッド作成
          </button>
        </div>
      )}
    </section>
  )
}
