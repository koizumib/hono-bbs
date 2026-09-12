import { Fragment, forwardRef, memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useThreads } from '../hooks/useThreads'
import { useThreadView } from '../hooks/useThreadView'
import { useSwipeGesture } from '../hooks/useSwipeGesture'
import { useNewIdsFlash } from '../hooks/useNewIdsFlash'
import { calculateMomentum, rankMomentum } from '../utils/momentum'
import { useThreadHistoryVersionStore } from '../stores/threadHistoryVersionStore'
import { cycleSort, type SortState } from '../utils/sortCycle'
import { useSettingsStore } from '../stores/settingsStore'
import { filterThreads } from '../utils/filter'
import NgHiddenNotice from '../components/ui/NgHiddenNotice'
import { fuzzyMatch } from '../utils/fuzzySearch'
import { getHistory, forgetThread } from '../utils/threadHistory'
import { getThreadPosts } from '../api/posts'
import { reportThread } from '../api/threads'
import ThreadCard from '../components/thread/ThreadCard'
import PostArticle from '../components/post/PostArticle'
import PostPopup from '../components/post/PostPopup'
import Minimap from '../components/post/Minimap'
import ReplyForm from '../components/post/ReplyForm'
import MobileTopBar from '../components/mobile/MobileTopBar'
import MobileBoardDrawer from '../components/mobile/MobileBoardDrawer'
import SwipeHintOverlay from '../components/mobile/SwipeHintOverlay'
import PullSpinner from '../components/ui/PullSpinner'
import {
  PULL_SNAP_TRANSITION,
  PULL_SETTLE_TRANSITION,
  PULL_HIDDEN_Y,
  PULL_REVEAL_Y,
  MIN_SPIN_MS,
  dampedPullY,
} from '../utils/pullRefresh'

// ─── スレッド一覧パネル ────────────────────────────────────────────────────────

type SortMode = 'momentum' | 'newest'

interface MobileThreadListPanelProps {
  boardId: string | undefined
  onMenuClick: () => void
  onSelectThread: (threadId: string) => void
}

export interface MobileThreadListPanelHandle {
  scrollToTop: () => void
  scrollToBottom: () => void
}

const MobileThreadListPanel = memo(forwardRef<MobileThreadListPanelHandle, MobileThreadListPanelProps>(function MobileThreadListPanel({
  boardId,
  onMenuClick,
  onSelectThread,
}, ref) {
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch, dataUpdatedAt } = useThreads(boardId)
  const ngRules = useSettingsStore((s) => s.ngRules)
  const lastRefreshRef = useRef(0)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const [sortState, setSortState] = useState<SortState<SortMode> | null>(null)
  const [showUnread, setShowUnread] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  // スレッド表示画面で新着レスを取得した際にも自動で再計算されるよう、
  // ローカルstateではなく共有ストアの更新カウンタを使う
  const historyVersion = useThreadHistoryVersionStore((s) => s.version)

  const board = data?.data.board
  const rawThreads = useMemo(() => data?.data.threads ?? [], [data])
  const baseThreads = useMemo(() => filterThreads(rawThreads, ngRules), [rawThreads, ngRules])
  // 勢いは板ごとの相対順位で色付けする(過疎板でも一番勢いがあるスレは赤くなるように)
  const momentumRankMap = useMemo(() => rankMomentum(baseThreads), [baseThreads])

  const history = useMemo(() => getHistory(), [historyVersion])

  // フィルタ/ソート/検索は重い処理なので、更新中の再レンダー(refetchによる複数回の
  // 再描画)のたびに再計算しないようメモ化する。未メモ化だとリフレッシュ中に
  // メインスレッドが詰まり、更新アイコンのspinアニメーションがガクつく原因になっていた。
  const threads = useMemo(() => {
    let result = [...baseThreads]
    if (sortState?.mode === 'momentum') {
      const sign = sortState.dir === 'asc' ? 1 : -1
      // ThreadCardの炎アイコンと同じ計算式(calculateMomentum)を使う。以前は独自の
      // (1日未満は1日として丸める)計算だったため、24時間以内のスレッド同士で
      // アイコンの色とソート順が食い違うことがあった。
      result = result.slice().sort((a, b) => (calculateMomentum(a) - calculateMomentum(b)) * sign)
    } else if (sortState?.mode === 'newest') {
      const sign = sortState.dir === 'asc' ? 1 : -1
      result = result.slice().sort((a, b) => {
        const da = new Date(a.firstPost?.createdAt ?? a.createdAt).getTime()
        const db = new Date(b.firstPost?.createdAt ?? b.createdAt).getTime()
        return (da - db) * sign
      })
    }
    if (showUnread) {
      result = result.filter((t) => {
        const entry = history.find((e) => e.boardId === boardId && e.threadId === t.id)
        return entry !== undefined && entry.lastReadCount < t.postCount
      })
    }
    if (searchQuery.trim()) {
      result = result.filter((t) => fuzzyMatch(t.title, searchQuery))
    }
    return result
  }, [baseThreads, sortState, showUnread, history, searchQuery, boardId])

  // 更新で新しく取得できたスレッドを描画時に一瞬光らせる。
  // フィルタ/ソート後のthreadsを渡すと、未読フィルタのON/OFFや並び替えで
  // 「表示から一時的に消えていただけ」のスレッドまで新着扱いされてしまう
  // (再表示のたびにほぼ全件が誤って光るバグの原因だった)。サーバーから
  // 取得した生データ(rawThreads)を渡し、UI操作では変化しない基準にする。
  // enabled: !isLoadingを渡さないと、ローディング中の一時的な空配列を「初回の基準」として
  // 記録した直後に本物のデータが届き、全件が新着と誤検知されてしまう
  // (ブラウザリロード時に全スレッドが光る不具合の原因だった)。
  const { newSinceLastLoad: newThreadIds, flashingNow } = useNewIdsFlash(useMemo(() => rawThreads.map((t) => t.id), [rawThreads]), dataUpdatedAt, boardId, undefined, !isLoading)

  // プルリフレッシュ側が実際の完了タイミングを待てるように、refetchのPromiseを返す
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

  // プルリフレッシュ＋カスタムスクロールバー（スクロールdivのみ）
  const listScrollRef = useRef<HTMLDivElement>(null)
  const listThumbRef = useRef<HTMLDivElement>(null)
  const listPullStartRef = useRef<{ x: number; y: number } | null>(null)
  const listPullIndicatorRef = useRef<HTMLDivElement>(null)
  const listPullIconRef = useRef<HTMLSpanElement>(null)
  const LIST_PULL_THRESHOLD = 70

  // →↑/→↓ ジェスチャーから一覧を最下部/最上部へ移動できるように公開する。
  // ジェスチャー用なのでアニメーションなしで即座に移動する（ヘッダータップとは区別する）。
  useImperativeHandle(ref, () => ({
    scrollToTop: () => {
      const el = listScrollRef.current
      if (el) el.scrollTop = 0
    },
    scrollToBottom: () => {
      const el = listScrollRef.current
      if (el) el.scrollTop = el.scrollHeight
    },
  }), [])

  function handleListScroll() {
    const el = listScrollRef.current
    const thumb = listThumbRef.current
    if (!el || !thumb) return
    const { scrollHeight, clientHeight, scrollTop } = el
    if (scrollHeight <= clientHeight) { thumb.style.display = 'none'; return }
    thumb.style.display = 'block'
    thumb.style.height = `${(clientHeight / scrollHeight) * 100}%`
    thumb.style.top = `${(scrollTop / scrollHeight) * 100}%`
  }

  function handleListTouchStart(e: React.TouchEvent) {
    const el = listScrollRef.current
    if (el && el.scrollTop <= 0) {
      listPullStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      // ドラッグ中は指に追従させるため、前回の設定アニメーションを解除しておく
      const ind = listPullIndicatorRef.current
      if (ind) ind.style.transition = 'none'
    }
  }

  function handleListTouchMove(e: React.TouchEvent) {
    if (!listPullStartRef.current) return
    const dx = e.touches[0].clientX - listPullStartRef.current.x
    const dy = e.touches[0].clientY - listPullStartRef.current.y
    // 横方向が優位なら、これは板一覧の左右スワイプジェスチャー。プルリフレッシュ扱いにしない。
    if (Math.abs(dx) > Math.abs(dy) + 5) { listPullStartRef.current = null; return }
    if (dy <= 0) { listPullStartRef.current = null; return }
    const ind = listPullIndicatorRef.current
    // 位置はゴムひものように徐々に速度が落ちながら追従、回転は閾値でちょうど1周する
    const rotateProgress = Math.min(1, dy / LIST_PULL_THRESHOLD)
    if (ind) {
      ind.style.transform = `translateY(${dampedPullY(dy, LIST_PULL_THRESHOLD)}px)`
      ind.style.opacity = String(Math.min(1, rotateProgress + 0.15))
    }
    if (listPullIconRef.current) listPullIconRef.current.style.transform = `rotate(${rotateProgress * 360}deg)`
  }

  function handleListTouchEnd(e: React.TouchEvent) {
    if (!listPullStartRef.current) return
    const dy = e.changedTouches[0].clientY - listPullStartRef.current.y
    listPullStartRef.current = null
    const ind = listPullIndicatorRef.current
    const icon = listPullIconRef.current
    if (dy >= LIST_PULL_THRESHOLD) {
      // 指を離した瞬間、確定位置まで素早くスナップしてそこで回り続ける
      if (ind) { ind.style.transition = PULL_SNAP_TRANSITION; ind.style.transform = `translateY(${PULL_REVEAL_Y}px)`; ind.style.opacity = '1' }
      if (icon) { icon.style.transform = ''; icon.classList.add('animate-spin') }
      const spinStart = Date.now()
      void (async () => {
        await handleRefresh()
        const elapsed = Date.now() - spinStart
        if (elapsed < MIN_SPIN_MS) await new Promise((r) => setTimeout(r, MIN_SPIN_MS - elapsed))
        if (ind) { ind.style.transition = PULL_SETTLE_TRANSITION; ind.style.transform = `translateY(${PULL_HIDDEN_Y}px)`; ind.style.opacity = '0' }
        if (icon) icon.classList.remove('animate-spin')
      })()
    } else {
      if (ind) { ind.style.transition = PULL_SETTLE_TRANSITION; ind.style.opacity = '0'; ind.style.transform = `translateY(${PULL_HIDDEN_Y}px)` }
      if (icon) icon.style.transform = ''
    }
  }

  const SORT_LABELS: Record<SortMode, string> = { momentum: '勢い', newest: '新着' }
  const SORT_MODES: SortMode[] = ['momentum', 'newest']

  return (
    <div
      className="flex flex-col h-full bg-c-base"
    >
      <MobileTopBar
        title={board?.name ?? (boardId ? '読み込み中...' : '板を選択')}
        centerTitle
        onMenuClick={onMenuClick}
        rightContent={
          boardId ? (
            <div className="flex items-center gap-0.5">
              <button
                className="p-2 rounded text-slate-400 active:bg-c-accent/10 dark:active:bg-c-accent/20 transition-colors"
                onClick={() => navigate(`/new-thread/${boardId}`)}
              >
                <span className="material-symbols-outlined text-xl">edit_square</span>
              </button>
              <button
                className="p-2 rounded text-slate-400 active:bg-c-accent/10 dark:active:bg-c-accent/20 transition-colors"
                onClick={() => setShowSearch((s) => !s)}
              >
                <span className="material-symbols-outlined text-xl">search</span>
              </button>
            </div>
          ) : undefined
        }
      />

      {showSearch && boardId && (
        <div className="px-2 py-1 border-b border-c-border flex-shrink-0">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="スレッド検索..."
            autoFocus
            className="w-full bg-c-surface2 border border-c-border rounded-lg px-2 py-1.5 text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-c-accent/50"
          />
        </div>
      )}

      <NgHiddenNotice count={rawThreads.length - baseThreads.length} />

      <div className="flex-1 relative overflow-hidden">
        {/* プルリフレッシュの丸矢印。コンテンツを押し下げず、独立してヘッダー下から降りてくる */}
        <div
          ref={listPullIndicatorRef}
          className="absolute left-0 right-0 top-0 flex justify-center select-none pointer-events-none z-20"
          style={{ opacity: 0, transform: `translateY(${PULL_HIDDEN_Y}px)` }}
        >
          <PullSpinner iconRef={listPullIconRef} />
        </div>
        <div
          ref={listScrollRef}
          className="h-full overflow-y-auto select-none"
          style={{ overscrollBehaviorY: 'contain' }}
          onScroll={handleListScroll}
          onTouchStart={handleListTouchStart}
          onTouchMove={handleListTouchMove}
          onTouchEnd={handleListTouchEnd}
        >
          {!boardId ? (
            <div className="p-6 text-center text-slate-500 text-sm">メニューから板を選択してください</div>
          ) : isError && !board ? (
            <div className="p-6 text-center text-slate-500 text-sm">データが取得できませんでした</div>
          ) : isLoading ? (
            <div className="p-6 text-center text-slate-500 text-sm">読み込み中...</div>
          ) : threads.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-sm">スレッドがありません</div>
          ) : (
            <div className="p-1.5 flex flex-col gap-1.5">
            {threads.map((thread) => (
              <ThreadCard
                key={thread.id}
                thread={thread}
                // モバイルは単一パネル遷移(PCの分割表示と違い、一覧に戻った時点でどのスレッドも
                // 「表示中」ではない)なので、直前まで開いていたスレッドをハイライトし続けない
                isActive={false}
                isSelected={false}
                compact
                isNew={newThreadIds.has(thread.id)}
                flash={flashingNow.has(thread.id)}
                momentumRank={momentumRankMap.get(thread.id) ?? 0}
                onClick={() => onSelectThread(thread.id)}
              />
            ))}
            </div>
          )}
        </div>
        {/* カスタムスクロールバー */}
        <div className="absolute right-0 top-0 bottom-0 w-[3px] pointer-events-none z-10">
          <div
            ref={listThumbRef}
            className="absolute left-0 right-0 rounded-full"
            style={{ background: 'rgba(100,116,139,0.5)', minHeight: '20px', display: 'none' }}
          />
        </div>
      </div>

      {boardId && (
        <footer className="flex items-center gap-3 px-6 py-2 border-t border-c-border bg-c-surface flex-shrink-0 text-xs font-medium">
          {/* 未読フィルタ（PCと同じ下線タブ形式。ソートボタンと幅を揃える） */}
          <button
            type="button"
            onClick={() => setShowUnread((s) => !s)}
            className={`relative px-3 py-2.5 flex items-center justify-center min-w-[68px] text-xs font-medium transition-colors ${
              showUnread ? 'text-c-accent' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            未読
            {showUnread && <span className="absolute bottom-0.5 left-1.5 right-1.5 h-[2px] bg-c-accent rounded-full" />}
          </button>
          {/* ソートボタン（勢い・新着、レス抽出タブと同じ下線タブ形式。クリックで昇順→降順→オフを巡回） */}
          {SORT_MODES.map((mode) => {
            const active = sortState?.mode === mode
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setSortState((s) => cycleSort(s, mode))}
                className={`relative px-3 py-2.5 flex items-center justify-center gap-0.5 min-w-[68px] text-xs font-medium transition-colors ${
                  active ? 'text-c-accent' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {SORT_LABELS[mode]}
                <span className={`material-symbols-outlined text-sm leading-none ${active ? '' : 'invisible'}`}>
                  {active && sortState.dir === 'desc' ? 'arrow_downward' : 'arrow_upward'}
                </span>
                {active && (
                  <span className="absolute bottom-0.5 left-1.5 right-1.5 h-[2px] bg-c-accent rounded-full" />
                )}
              </button>
            )
          })}
          <div className="flex-1" />
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${isRefreshing ? 'text-c-accent bg-c-accent/10' : 'text-slate-400 bg-c-surface2 active:bg-slate-100 dark:active:bg-slate-800'}`}
          >
            <span className={`material-symbols-outlined text-xl${isRefreshing ? ' animate-spin' : ''}`}>refresh</span>
          </button>
        </footer>
      )}
    </div>
  )
}))

// ─── 書き込みパネル（右からスライド）────────────────────────────────────────

interface MobileReplyPanelProps {
  boardId: string
  threadId: string
  insertAnchor: { text: string; seq: number } | null
  onClose: () => void
  onPosted?: () => void
}

function MobileReplyPanel({ boardId, threadId, insertAnchor, onClose, onPosted }: MobileReplyPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  // マウント時にスライドイン（useLayoutEffect で初期位置を確定してからアニメーション）
  useLayoutEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    panel.style.transform = 'translateX(100%)'
    panel.style.transition = 'none'
    const id = requestAnimationFrame(() => {
      panel.style.transition = 'transform 280ms cubic-bezier(0.32, 0.72, 0, 1)'
      panel.style.transform = 'translateX(0)'
    })
    return () => cancelAnimationFrame(id)
  }, [])

  // スライドアウトしてから onClose
  function handleClose() {
    const panel = panelRef.current
    if (panel) {
      panel.style.transition = 'transform 250ms ease'
      panel.style.transform = 'translateX(100%)'
    }
    setTimeout(onClose, 250)
  }

  // スワイプ右で閉じる（ジェスチャー中は画面を動かさず、指を離してから遷移する）
  const swipe = useSwipeGesture({
    right: { label: '戻る', onCommit: handleClose },
  })

  function handleTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    e.stopPropagation()
    swipe.onTouchStart(e)
  }

  function handleTouchEnd(e: React.TouchEvent) {
    e.stopPropagation()
    swipe.onTouchEnd(e)
  }

  return (
    <div
      ref={panelRef}
      className="absolute inset-0 bg-c-base flex flex-col z-20"
      style={{ willChange: 'transform' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <SwipeHintOverlay label={swipe.label} />
      <MobileTopBar title="書き込む" onBack={handleClose} />
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <ReplyForm
          boardId={boardId}
          threadId={threadId}
          layout="sheet"
          insertAnchor={insertAnchor}
          onPosted={() => { onPosted?.(); onClose() }}
        />
      </div>
    </div>
  )
}

// ─── スレッド詳細パネル内部 ────────────────────────────────────────────────────

interface MobileThreadViewInnerProps {
  boardId: string
  threadId: string
  onBack: () => void
  onOpenReply: (postNumber?: number) => void
  handlePostedRef?: React.MutableRefObject<() => void>
}

export interface MobileThreadViewInnerHandle {
  scrollToTop: () => void
  scrollToBottom: () => void
}

const MobileThreadViewInner = forwardRef<MobileThreadViewInnerHandle, MobileThreadViewInnerProps>(function MobileThreadViewInner({
  boardId,
  threadId,
  onBack,
  onOpenReply,
  handlePostedRef,
}, ref) {
  // 履歴からタイトルをキャッシュ（API応答前に即座に表示するため）
  const [cachedTitle] = useState(() => {
    const entry = getHistory().find(e => e.boardId === boardId && e.threadId === threadId)
    return entry?.threadTitle ?? null
  })

  // closeAll を onReply コールバック内から参照するための ref
  const closeAllRef = useRef<() => void>(() => {})
  const queryClient = useQueryClient()

  const {
    thread,
    isLoading,
    isError,
    filteredPosts,
    ngHiddenCount,
    anchorCountMap,
    idCountMap,
    ownPostNumbers,
    replyToOwnNumbers,
    firstNewIndex,
    newPostIds,
    positioned,
    newPostsVisible,
    scrollAreaRef,
    handleScroll,
    containerRect,
    popups,
    postFilters,
    searchQuery,
    handlers,
    handleRefresh,
    handlePosted,
    toggleFilter,
    setSearchQuery,
    clearFilters,
    closeTop,
    closeAll,
  } = useThreadView(boardId, threadId, { onReply: (n) => { closeAllRef.current(); onOpenReply(n) } })

  // ref を常に最新の closeAll に同期
  closeAllRef.current = closeAll

  // handlePostedRef を常に最新の handlePosted に同期
  if (handlePostedRef) handlePostedRef.current = handlePosted

  const [showSearch, setShowSearch] = useState(false)
  const [isViewRefreshing, setIsViewRefreshing] = useState(false)
  const lastViewRefreshRef = useRef(0)
  const [showKebab, setShowKebab] = useState(false)
  const [showThreadInfo, setShowThreadInfo] = useState(false)

  // プルリフレッシュ側が実際の完了タイミングを待てるように、Promiseを返す
  async function doRefresh() {
    const now = Date.now()
    if (now - lastViewRefreshRef.current < 500) return
    lastViewRefreshRef.current = now
    setIsViewRefreshing(true)
    try {
      await handleRefresh()
    } finally {
      setIsViewRefreshing(false)
    }
  }

  // プルリフレッシュ
  const viewPullStartRef = useRef<{ x: number; y: number; atBottom: boolean } | null>(null)
  const viewTopPullRef = useRef<HTMLDivElement>(null)
  const viewBottomPullRef = useRef<HTMLDivElement>(null)
  const viewTopPullIconRef = useRef<HTMLSpanElement>(null)
  const viewBottomPullIconRef = useRef<HTMLSpanElement>(null)
  const VIEW_PULL_THRESHOLD = 70

  function handleViewTouchStart(e: React.TouchEvent) {
    const el = scrollAreaRef.current
    if (!el) return
    const atTop = el.scrollTop === 0
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 10
    if (!atTop && !atBottom) return
    // コンテンツが短い場合は atTop を優先（下に引いて更新できるように）
    viewPullStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, atBottom: !atTop && atBottom }
    // ドラッグ中は指に追従させるため、前回の設定アニメーションを解除しておく
    if (viewTopPullRef.current) viewTopPullRef.current.style.transition = 'none'
    if (viewBottomPullRef.current) viewBottomPullRef.current.style.transition = 'none'
  }

  function handleViewTouchMove(e: React.TouchEvent) {
    if (!viewPullStartRef.current) return
    const dx = e.touches[0].clientX - viewPullStartRef.current.x
    const raw = e.touches[0].clientY - viewPullStartRef.current.y
    // 横方向が優位なら、これはスレッド表示の左右スワイプジェスチャー。プルリフレッシュ扱いにしない。
    if (Math.abs(dx) > Math.abs(raw) + 5) { viewPullStartRef.current = null; return }
    const atBottom = viewPullStartRef.current.atBottom
    const dy = atBottom ? -raw : raw
    if (dy <= 0) return
    // 位置はゴムひものように徐々に速度が落ちながら追従、回転は閾値でちょうど1周する
    const rotateProgress = Math.min(1, dy / VIEW_PULL_THRESHOLD)
    const ind = atBottom ? viewBottomPullRef.current : viewTopPullRef.current
    const icon = atBottom ? viewBottomPullIconRef.current : viewTopPullIconRef.current
    // 下側は逆向き(下に隠れていて上に上がってくる)なので符号を反転させる
    const sign = atBottom ? -1 : 1
    if (ind) {
      ind.style.transform = `translateY(${sign * dampedPullY(dy, VIEW_PULL_THRESHOLD)}px)`
      ind.style.opacity = String(Math.min(1, rotateProgress + 0.15))
    }
    if (icon) icon.style.transform = `rotate(${rotateProgress * 360}deg)`
  }

  function handleViewTouchEnd(e: React.TouchEvent) {
    if (!viewPullStartRef.current) return
    const raw = e.changedTouches[0].clientY - viewPullStartRef.current.y
    const atBottom = viewPullStartRef.current.atBottom
    const dy = atBottom ? -raw : raw
    viewPullStartRef.current = null
    const sign = atBottom ? -1 : 1
    const inactiveSign = atBottom ? 1 : -1
    const activeInd = atBottom ? viewBottomPullRef.current : viewTopPullRef.current
    const inactiveInd = atBottom ? viewTopPullRef.current : viewBottomPullRef.current
    const activeIcon = atBottom ? viewBottomPullIconRef.current : viewTopPullIconRef.current
    const inactiveIcon = atBottom ? viewTopPullIconRef.current : viewBottomPullIconRef.current
    if (inactiveInd) {
      inactiveInd.style.transition = PULL_SETTLE_TRANSITION
      inactiveInd.style.transform = `translateY(${inactiveSign * PULL_HIDDEN_Y}px)`
      inactiveInd.style.opacity = '0'
    }
    if (inactiveIcon) inactiveIcon.style.transform = ''
    if (dy >= VIEW_PULL_THRESHOLD) {
      // 指を離した瞬間、確定位置まで素早くスナップしてそこで回り続ける
      if (activeInd) { activeInd.style.transition = PULL_SNAP_TRANSITION; activeInd.style.transform = `translateY(${sign * PULL_REVEAL_Y}px)`; activeInd.style.opacity = '1' }
      if (activeIcon) { activeIcon.style.transform = ''; activeIcon.classList.add('animate-spin') }
      const spinStart = Date.now()
      void (async () => {
        await doRefresh()
        const elapsed = Date.now() - spinStart
        if (elapsed < MIN_SPIN_MS) await new Promise((r) => setTimeout(r, MIN_SPIN_MS - elapsed))
        if (activeInd) { activeInd.style.transition = PULL_SETTLE_TRANSITION; activeInd.style.transform = `translateY(${sign * PULL_HIDDEN_Y}px)`; activeInd.style.opacity = '0' }
        if (activeIcon) activeIcon.classList.remove('animate-spin')
      })()
    } else {
      if (activeInd) { activeInd.style.transition = PULL_SETTLE_TRANSITION; activeInd.style.transform = `translateY(${sign * PULL_HIDDEN_Y}px)`; activeInd.style.opacity = '0' }
      if (activeIcon) activeIcon.style.transform = ''
    }
  }

  // ヘッダー(タイトル)タップはアニメーション付きでスクロール
  const scrollToTop = useCallback(() => {
    const el = scrollAreaRef.current
    if (el) el.scrollTo({ top: 0, behavior: 'smooth' })
  }, [scrollAreaRef])

  const scrollToBottom = useCallback(() => {
    const el = scrollAreaRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [scrollAreaRef])

  // →↑/→↓ ジェスチャーからスレッドの投稿一覧を最下部/最上部へ移動できるように公開する。
  // こちらはジェスチャー用なのでアニメーションなしで即座に移動する。
  useImperativeHandle(ref, () => ({
    scrollToTop: () => {
      const el = scrollAreaRef.current
      if (el) el.scrollTop = 0
    },
    scrollToBottom: () => {
      const el = scrollAreaRef.current
      if (el) el.scrollTop = el.scrollHeight
    },
  }), [scrollAreaRef])

  return (
    <div className="flex flex-col h-full relative">
      {/* トップバー: タイトルタップで先頭へ */}
      <MobileTopBar
        title={thread?.title ?? cachedTitle ?? '読み込み中...'}
        onBack={onBack}
        onTitleClick={scrollToTop}
        rightContent={
          <div className="flex items-center gap-0.5">
            <button
              className="p-2 rounded text-slate-400 active:bg-c-accent/10 dark:active:bg-c-accent/20 transition-colors"
              onClick={() => setShowSearch((s) => !s)}
            >
              <span className="material-symbols-outlined text-xl">search</span>
            </button>
            <button
              className="p-2 rounded text-slate-400 active:bg-c-accent/10 dark:active:bg-c-accent/20 transition-colors"
              onClick={() => setShowKebab((s) => !s)}
            >
              <span className="material-symbols-outlined text-xl">more_vert</span>
            </button>
          </div>
        }
      />

      <NgHiddenNotice count={ngHiddenCount} />

      {showSearch && (
        <div className="px-2 py-1 border-b border-c-border flex-shrink-0">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="レス検索..."
            autoFocus
            className="w-full bg-c-surface2 border border-c-border rounded-lg px-2 py-1.5 text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-c-accent/50"
          />
        </div>
      )}

      {/* フィルタータブ（下線タブ形式・横スクロール） */}
      <div className="flex items-center gap-2 px-2.5 border-b border-c-border bg-c-surface/50 flex-shrink-0 overflow-x-auto no-scrollbar text-sm font-medium">
        <button
          type="button"
          onClick={clearFilters}
          className={`relative py-3 px-1.5 shrink-0 transition-colors ${
            postFilters.size === 0 ? 'text-c-accent' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          すべて
          {postFilters.size === 0 && (
            <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-c-accent rounded-full" />
          )}
        </button>
        {[
          { key: 'popular', label: '人気', icon: 'local_fire_department' },
          { key: 'image',   label: '画像', icon: 'image' },
          { key: 'video',   label: '動画', icon: 'play_circle' },
          { key: 'link',    label: 'リンク', icon: 'link' },
        ].map(({ key, label, icon }) => {
          const active = postFilters.has(key)
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleFilter(key)}
              className={`relative py-3 px-1.5 shrink-0 flex items-center gap-1 transition-colors whitespace-nowrap ${
                active ? 'text-c-accent' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <span className="material-symbols-outlined text-base leading-none">{icon}</span>
              {label}
              {active && (
                <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-c-accent rounded-full" />
              )}
            </button>
          )
        })}
      </div>

      {/* 投稿リスト */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* プルリフレッシュの丸矢印。コンテンツを押し下げず、独立してヘッダー下から降りてくる/フッター下から上がってくる */}
        <div
          ref={viewTopPullRef}
          className="absolute left-0 right-0 top-0 flex justify-center select-none pointer-events-none z-20"
          style={{ opacity: 0, transform: `translateY(${PULL_HIDDEN_Y}px)` }}
        >
          <PullSpinner iconRef={viewTopPullIconRef} />
        </div>
        <div
          ref={viewBottomPullRef}
          className="absolute left-0 right-0 bottom-0 flex justify-center select-none pointer-events-none z-20"
          style={{ opacity: 0, transform: `translateY(${-PULL_HIDDEN_Y}px)` }}
        >
          <PullSpinner iconRef={viewBottomPullIconRef} />
        </div>
        <div
          ref={scrollAreaRef}
          onScroll={handleScroll}
          onTouchStart={handleViewTouchStart}
          onTouchMove={handleViewTouchMove}
          onTouchEnd={handleViewTouchEnd}
          className="flex-1 overflow-y-auto custom-scrollbar px-1.5 py-1 space-y-2 [&::-webkit-scrollbar]:w-[4px]"
          style={{ overscrollBehaviorY: 'contain' }}
        >
        {isError && !thread ? (
          <div className="text-slate-500 text-sm p-4">データが取得できませんでした</div>
        ) : isLoading ? (
          <div className="text-slate-500 text-sm p-4">読み込み中...</div>
        ) : filteredPosts.length === 0 ? (
          <div className="text-slate-500 text-sm p-4">投稿がありません</div>
        ) : (
          filteredPosts.map((post, i) => {
            const content = (
              <>
                {i === firstNewIndex && (
                  <div id="unread-divider" className="flex items-center gap-2 py-0.5 select-none" style={{ color: 'var(--c-accent-self)', opacity: 0.6 }}>
                    <div className="flex-1 h-px" style={{ background: 'var(--c-accent-self)', opacity: 0.4 }} />
                    <span className="text-[9px] font-bold tracking-widest whitespace-nowrap">ここから未読</span>
                    <div className="flex-1 h-px" style={{ background: 'var(--c-accent-self)', opacity: 0.4 }} />
                  </div>
                )}
                <PostArticle
                  post={post}
                  anchorCount={anchorCountMap.get(post.postNumber) ?? 0}
                  idCount={idCountMap.get(post.authorId) ?? 1}
                  handlers={handlers}
                  isOwnPost={ownPostNumbers.has(post.postNumber)}
                  isReplyToOwn={replyToOwnNumbers.has(post.postNumber)}
                  compact
                  showTopDivider={i > 0 && i !== firstNewIndex}
                  // newPostsVisible=falseの間(初回表示のフェードイン待ち)はまだ
                  // 不可視なので、見える(newPostsVisible=true)タイミングに合わせて
                  // flash-newアニメーションを発火させる
                  isNew={newPostsVisible && newPostIds.has(post.id)}
                />
              </>
            )
            // 未読レスはスレッド表示位置が決まった後、少し遅れてフェードインさせる
            // (「まずスレッドを表示→その後に新着レスを表示」という順序にするため)
            if (firstNewIndex !== -1 && i >= firstNewIndex) {
              return (
                <div key={post.id} className={`transition-opacity duration-300 ${newPostsVisible ? 'opacity-100' : 'opacity-0'}`}>
                  {content}
                </div>
              )
            }
            return <Fragment key={post.id}>{content}</Fragment>
          })
        )}
        </div>
        {/* 表示位置(スクロール復元/未読ジャンプ)が決まるまでコンテンツを覆う */}
        {!positioned && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-c-base">
            <span className="material-symbols-outlined text-3xl text-slate-400 animate-spin">progress_activity</span>
          </div>
        )}
        {filteredPosts.length > 0 && (
          <Minimap
            posts={filteredPosts}
            scrollAreaRef={scrollAreaRef}
            anchorCountMap={anchorCountMap}
            ownPostNumbers={ownPostNumbers}
            replyToOwnNumbers={replyToOwnNumbers}
          />
        )}
      </div>

      {/* フッター: タップで最下部へ・書き込む・更新 */}
      <footer
        className="flex items-center gap-2 px-7 py-2 border-t border-c-border bg-c-surface flex-shrink-0"
        onClick={scrollToBottom}
      >
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); (e.currentTarget as HTMLButtonElement).blur(); doRefresh() }}
          disabled={isViewRefreshing}
          className={`flex items-center gap-1 px-2.5 py-[7px] rounded transition-colors text-xs font-medium flex-shrink-0 ${isViewRefreshing ? 'text-c-accent bg-c-accent/10' : 'text-slate-500 dark:text-slate-400 bg-c-surface2 active:bg-slate-100 dark:active:bg-slate-800'}`}
        >
          <span className={`material-symbols-outlined text-base${isViewRefreshing ? ' animate-spin' : ''}`}>refresh</span>
          更新
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); closeAll(); onOpenReply() }}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3.5 bg-c-accent active:opacity-90 text-[var(--c-accent-text)] rounded text-xs font-medium shadow transition-all"
        >
          <span className="material-symbols-outlined text-base">edit</span>
          書き込む
        </button>
      </footer>

      {/* ポップアップ（PC 互換・スタイル・hideTitle・compact） */}
      <PostPopup
        popups={popups}
        containerRect={containerRect}
        anchorCountMap={anchorCountMap}
        idCountMap={idCountMap}
        handlers={handlers}
        onCloseTop={closeTop}
        onCloseAll={closeAll}
        hideTitle
        compact
      />

      {/* ケバブメニュー */}
      {showKebab && (
        <>
          <div className="absolute inset-0 z-30" onClick={() => setShowKebab(false)} />
          <div className="absolute top-14 right-2 z-40 bg-c-surface border border-c-border rounded-xl shadow-xl overflow-hidden min-w-[160px]">
            <button
              type="button"
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-c-surface2 transition-colors"
              onClick={() => { setShowKebab(false); setShowThreadInfo(true) }}
            >
              <span className="material-symbols-outlined text-lg">info</span>
              スレッド情報
            </button>
            <button
              type="button"
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-c-surface2 transition-colors"
              onClick={async () => {
                setShowKebab(false)
                if (!boardId || !threadId) return
                if (!window.confirm('このスレッドを通報しますか？')) return
                try {
                  await reportThread(boardId, threadId)
                  window.alert('通報しました')
                } catch {
                  window.alert('通報に失敗しました')
                }
              }}
            >
              <span className="material-symbols-outlined text-lg">flag</span>
              スレッドを通報
            </button>
            <button
              type="button"
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-c-surface2 transition-colors"
              onClick={() => { setShowKebab(false); onBack() }}
            >
              <span className="material-symbols-outlined text-lg">arrow_back</span>
              板に戻る
            </button>
            <button
              type="button"
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
              onClick={() => { setShowKebab(false); forgetThread(queryClient, boardId, threadId); onBack() }}
            >
              <span className="material-symbols-outlined text-lg">delete</span>
              閲覧履歴を削除
            </button>
          </div>
        </>
      )}

      {/* スレッド情報シート */}
      {showThreadInfo && (
        <>
          <div className="absolute inset-0 bg-black/50 z-30" onClick={() => setShowThreadInfo(false)} />
          <div className="absolute bottom-0 left-0 right-0 z-40 bg-c-surface border-t border-c-border rounded-t-2xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">スレッド情報</h3>
              <button onClick={() => setShowThreadInfo(false)} className="text-slate-400">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-500 mb-1">タイトル</p>
                <div className="flex items-start gap-2">
                  <p className="flex-1 text-sm text-slate-700 dark:text-slate-200 break-all">
                    {thread?.title ?? '読み込み中...'}
                    {thread?.isArchived && (
                      <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 align-middle">
                        dat落ち
                      </span>
                    )}
                  </p>
                  {thread?.title && (
                    <button
                      className="flex-shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                      onClick={() => void navigator.clipboard.writeText(thread.title)}
                    >
                      <span className="material-symbols-outlined text-lg">content_copy</span>
                    </button>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">URL</p>
                <div className="flex items-center gap-2">
                  <p className="flex-1 text-xs text-slate-500 truncate">{`${window.location.origin}/${boardId}/${threadId}`}</p>
                  <button
                    className="flex-shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                    onClick={() => void navigator.clipboard.writeText(`${window.location.origin}/${boardId}/${threadId}`)}
                  >
                    <span className="material-symbols-outlined text-lg">content_copy</span>
                  </button>
                </div>
              </div>
              {thread?.title && (
                <div className="pt-2 border-t border-c-border">
                  <button
                    className="w-full flex items-center gap-2 py-2 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                    onClick={() => void navigator.clipboard.writeText(`${thread.title}\n${window.location.origin}/${boardId}/${threadId}`)}
                  >
                    <span className="material-symbols-outlined text-base">content_copy</span>
                    スレタイ + URL をコピー
                  </button>
                </div>
              )}
              {thread && (
                <div className="flex items-center gap-4 pt-2 border-t border-c-border">
                  <span className="text-xs text-slate-500">
                    <span className="text-slate-700 dark:text-slate-200 font-bold">{thread.postCount}</span> 件
                  </span>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
})

// ─── メインページ ─────────────────────────────────────────────────────────────

export default function MobileBoardPage() {
  const { boardId, threadId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const handleMenuClick = useCallback(() => setDrawerOpen(true), [])
  const [replySheetOpen, setReplySheetOpen] = useState(false)

  // Panel B スライドアニメーション
  const [slideIn, setSlideIn] = useState(false)
  const [enableTransition, setEnableTransition] = useState(false)
  const panelBRef = useRef<HTMLDivElement>(null)
  const skipNextSlideInRef = useRef(false)

  // Panel A 左スワイプ → Panel B へ進む、右スワイプ → ドロワーを開く
  // →↑/→↓ の複合ジェスチャーで一覧を最下部/最上部へ移動する
  const [pendingThreadId, setPendingThreadId] = useState<string | null>(null)
  const lastViewedThreadIdRef = useRef('')
  const panelACommittedRef = useRef(false)
  const threadListPanelRef = useRef<MobileThreadListPanelHandle>(null)

  const panelASwipe = useSwipeGesture({
    left: {
      label: '進む',
      onCommit: () => {
        const targetThreadId = lastViewedThreadIdRef.current
        if (!targetThreadId || !boardId) return
        panelACommittedRef.current = true
        const panel = panelBRef.current
        if (panel) { panel.style.transition = 'transform 200ms cubic-bezier(0.32, 0.72, 0, 1)'; panel.style.transform = 'translateX(0)' }
        skipNextSlideInRef.current = true
        setTimeout(() => navigate(`/${boardId}/${targetThreadId}`), 200)
      },
    },
    right: {
      // ドロワーを開くジェスチャーは視覚フィードバックなし（ラベル非表示）で追跡のみ
      onCommit: () => setDrawerOpen(true),
    },
    'right,up': {
      label: '最下部へ',
      onCommit: () => threadListPanelRef.current?.scrollToBottom(),
    },
    'right,down': {
      label: '最上部へ',
      onCommit: () => threadListPanelRef.current?.scrollToTop(),
    },
  })

  function handlePanelATouchStart(e: React.TouchEvent<HTMLDivElement>) {
    if (threadId) return  // Panel B は開いているときは無効
    panelACommittedRef.current = false
    const lastEntry = boardId ? getHistory().find((entry) => entry.boardId === boardId) : null
    lastViewedThreadIdRef.current = lastEntry?.threadId ?? ''
    if (boardId && lastEntry) {
      // Panel B をプリマウント（空パネル）＆データをプリフェッチ
      setPendingThreadId(lastEntry.threadId)
      void queryClient.prefetchQuery({
        queryKey: ['posts', boardId, lastEntry.threadId],
        queryFn: () => getThreadPosts(boardId, lastEntry.threadId),
      })
    }
    panelASwipe.onTouchStart(e)
  }

  function handlePanelATouchEnd(e: React.TouchEvent) {
    panelASwipe.onTouchEnd(e)
    // 進むジェスチャーが確定しなかった場合、プリマウントした空パネルを片付ける
    if (!panelACommittedRef.current) setPendingThreadId(null)
  }

  // スレッドタップ → 即座に空パネル描画してからナビゲート
  const handleSelectThread = useCallback((selectedThreadId: string) => {
    if (!boardId) return
    // 空パネルをプリマウント
    setPendingThreadId(selectedThreadId)
    setSlideIn(false)
    setEnableTransition(false)
    // navigate 後の二重アニメーションを抑制
    skipNextSlideInRef.current = true
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setEnableTransition(true)
        setSlideIn(true)
        navigate(`/${boardId}/${selectedThreadId}`)
      })
    })
    // データをプリフェッチ
    void queryClient.prefetchQuery({
      queryKey: ['posts', boardId, selectedThreadId],
      queryFn: () => getThreadPosts(boardId, selectedThreadId),
    })
  }, [boardId, navigate, queryClient])

  // 返信アンカー
  const insertSeqRef = useRef(0)
  const [insertAnchor, setInsertAnchor] = useState<{ text: string; seq: number } | null>(null)

  // MobileThreadViewInner の handlePosted を外部から参照するための ref
  const handlePostedRef = useRef<() => void>(() => {})

  function handleOpenReply(postNumber?: number) {
    if (postNumber !== undefined) {
      insertSeqRef.current += 1
      setInsertAnchor({ text: String(postNumber), seq: insertSeqRef.current })
    }
    setReplySheetOpen(true)
  }

  // threadId 変化 → スライドイン（スワイプ遷移後はスキップ）
  const prevThreadIdRef = useRef(threadId)
  useEffect(() => {
    if (threadId === prevThreadIdRef.current) return
    prevThreadIdRef.current = threadId
    // pendingThreadId をクリア
    setPendingThreadId(null)
    if (skipNextSlideInRef.current) { skipNextSlideInRef.current = false; return }
    if (!threadId) { setSlideIn(false); setEnableTransition(false); return }
    setSlideIn(false); setEnableTransition(false)
    const id = requestAnimationFrame(() => { setEnableTransition(true); setSlideIn(true) })
    return () => cancelAnimationFrame(id)
  }, [threadId])

  // 初回マウント時に threadId があればスライドイン
  useEffect(() => {
    if (!threadId) return
    const id = requestAnimationFrame(() => { setEnableTransition(true); setSlideIn(true) })
    return () => cancelAnimationFrame(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // スライドアウト → navigate
  function goBack() {
    const panel = panelBRef.current
    if (panel) { panel.style.transition = 'transform 250ms ease'; panel.style.transform = 'translateX(100%)' }
    setTimeout(() => navigate(boardId ? `/${boardId}` : '/'), 250)
  }

  // Panel B のスワイプ（返信パネルが開いているときは無効化）
  // 右スワイプ = 戻る（一覧へ）、左スワイプ = 書き込みパネルを開く
  // ←↑ の複合ジェスチャーで、スレッドを閉じてその閲覧履歴も削除する
  // →↑/→↓ の複合ジェスチャーで、スレッドの投稿一覧を最下部/最上部へ移動する
  const threadViewRef = useRef<MobileThreadViewInnerHandle>(null)
  const panelBSwipe = useSwipeGesture({
    right: { label: '戻る', onCommit: goBack },
    left: { label: '書き込む', onCommit: () => handleOpenReply() },
    'right,up': {
      label: '最下部へ',
      onCommit: () => threadViewRef.current?.scrollToBottom(),
    },
    'right,down': {
      label: '最上部へ',
      onCommit: () => threadViewRef.current?.scrollToTop(),
    },
    'left,up': {
      label: '履歴を削除して閉じる',
      onCommit: () => {
        if (threadId && boardId) forgetThread(queryClient, boardId, threadId)
        goBack()
      },
    },
  })

  function handlePanelTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    if (replySheetOpen) return  // 返信パネル開中はスワイプ無効
    panelBSwipe.onTouchStart(e)
  }

  function handlePanelTouchEnd(e: React.TouchEvent) {
    if (replySheetOpen) return
    panelBSwipe.onTouchEnd(e)
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-c-base text-slate-700 dark:text-slate-200">
      {/* Panel A: スレッド一覧（左スワイプで Panel B へ進む） */}
      <div
        className="absolute inset-0"
        onTouchStart={handlePanelATouchStart}
        onTouchEnd={handlePanelATouchEnd}
      >
        <MobileThreadListPanel
          ref={threadListPanelRef}
          boardId={boardId}
          onMenuClick={handleMenuClick}
          onSelectThread={handleSelectThread}
        />
      </div>

      {/* Panel B: スレッド詳細（threadId or pendingThreadId で表示） */}
      {(threadId || pendingThreadId) && boardId && (
        <div
          ref={panelBRef}
          className="absolute inset-0 bg-c-base"
          style={{
            transform: slideIn ? 'translateX(0)' : 'translateX(100%)',
            transition: enableTransition ? 'transform 200ms cubic-bezier(0.32, 0.72, 0, 1)' : 'none',
            willChange: 'transform',
            zIndex: 10,
          }}
          onTouchStart={handlePanelTouchStart}
          onTouchEnd={handlePanelTouchEnd}
        >
          {threadId ? (
            <>
              <MobileThreadViewInner
                ref={threadViewRef}
                key={threadId}
                boardId={boardId}
                threadId={threadId}
                onBack={goBack}
                onOpenReply={handleOpenReply}
                handlePostedRef={handlePostedRef}
              />
              {/* 書き込みパネル（右からスライド） */}
              {replySheetOpen && (
                <MobileReplyPanel
                  key={`reply-${insertAnchor?.seq ?? 0}`}
                  boardId={boardId}
                  threadId={threadId}
                  insertAnchor={insertAnchor}
                  onClose={() => setReplySheetOpen(false)}
                  onPosted={() => handlePostedRef.current()}
                />
              )}
            </>
          ) : (
            // スワイプ中の空パネル
            <div className="flex flex-col h-full bg-c-base" />
          )}
        </div>
      )}

      {/* スワイプ中の「戻る」「進む」ラベル */}
      <SwipeHintOverlay label={panelASwipe.label ?? panelBSwipe.label} />

      {/* 板ドロワー */}
      <MobileBoardDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        currentBoardId={boardId}
      />
    </div>
  )
}
