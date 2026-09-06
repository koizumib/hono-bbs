import { Fragment, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useThreads } from '../hooks/useThreads'
import { useThreadView } from '../hooks/useThreadView'
import { useSettingsStore } from '../stores/settingsStore'
import { filterThreads } from '../utils/filter'
import { fuzzyMatch } from '../utils/fuzzySearch'
import { getHistory, removeThreadFromHistory } from '../utils/threadHistory'
import { getThreadPosts } from '../api/posts'
import ThreadCard from '../components/thread/ThreadCard'
import PostArticle from '../components/post/PostArticle'
import PostPopup from '../components/post/PostPopup'
import Minimap from '../components/post/Minimap'
import ReplyForm from '../components/post/ReplyForm'
import MobileTopBar from '../components/mobile/MobileTopBar'
import MobileBoardDrawer from '../components/mobile/MobileBoardDrawer'

// ─── スレッド一覧パネル ────────────────────────────────────────────────────────

type SortMode = 'momentum' | 'newest'

interface MobileThreadListPanelProps {
  boardId: string | undefined
  currentThreadId: string | undefined
  onMenuClick: () => void
  onSelectThread: (threadId: string) => void
}

const MobileThreadListPanel = memo(function MobileThreadListPanel({
  boardId,
  currentThreadId,
  onMenuClick,
  onSelectThread,
}: MobileThreadListPanelProps) {
  const navigate = useNavigate()
  const { data, isLoading, refetch } = useThreads(boardId)
  const ngWords = useSettingsStore((s) => s.ngWords)
  const lastRefreshRef = useRef(0)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const [sortMode, setSortMode] = useState<SortMode | null>(null)
  const [showUnread, setShowUnread] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [historyVersion, setHistoryVersion] = useState(0)

  const board = data?.data.board
  const rawThreads = data?.data.threads ?? []
  const baseThreads = filterThreads(rawThreads, ngWords)

  const history = useMemo(() => getHistory(), [historyVersion])

  let threads = [...baseThreads]
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
  if (showUnread) {
    threads = threads.filter((t) => {
      const entry = history.find((e) => e.boardId === boardId && e.threadId === t.id)
      return entry !== undefined && entry.lastReadCount < t.postCount
    })
  }
  if (searchQuery.trim()) {
    threads = threads.filter((t) => fuzzyMatch(t.title, searchQuery))
  }

  const handleRefresh = useCallback(() => {
    const now = Date.now()
    if (now - lastRefreshRef.current < 500) return
    lastRefreshRef.current = now
    setIsRefreshing(true)
    void refetch()
    setTimeout(() => setIsRefreshing(false), 500)
  }, [refetch])

  // プルリフレッシュ＋カスタムスクロールバー（スクロールdivのみ）
  const listScrollRef = useRef<HTMLDivElement>(null)
  const listThumbRef = useRef<HTMLDivElement>(null)
  const listPullStartRef = useRef<{ y: number } | null>(null)
  const listPullIndicatorRef = useRef<HTMLDivElement>(null)
  const LIST_PULL_THRESHOLD = 70
  const LIST_REFRESH_IND_H = 40

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
      listPullStartRef.current = { y: e.touches[0].clientY }
    }
  }

  function handleListTouchMove(e: React.TouchEvent) {
    if (!listPullStartRef.current) return
    const dy = e.touches[0].clientY - listPullStartRef.current.y
    if (dy <= 0) { listPullStartRef.current = null; return }
    const ind = listPullIndicatorRef.current
    if (ind) {
      const progress = Math.min(1, dy / LIST_PULL_THRESHOLD)
      ind.style.height = `${Math.min(dy * 0.4, LIST_REFRESH_IND_H)}px`
      ind.style.opacity = String(progress)
      ind.textContent = progress >= 1 ? '↑ 放すと更新' : '↓ 引いて更新'
    }
  }

  function handleListTouchEnd(e: React.TouchEvent) {
    if (!listPullStartRef.current) return
    const dy = e.changedTouches[0].clientY - listPullStartRef.current.y
    listPullStartRef.current = null
    const ind = listPullIndicatorRef.current
    if (dy >= LIST_PULL_THRESHOLD) {
      if (ind) {
        ind.style.height = `${LIST_REFRESH_IND_H}px`
        ind.style.opacity = '0.9'
        ind.textContent = '更新中...'
        setTimeout(() => { ind.style.height = '0'; ind.style.opacity = '0' }, 500)
      }
      handleRefresh()
    } else {
      if (ind) { ind.style.opacity = '0'; ind.style.height = '0'; ind.textContent = '↓ 引いて更新' }
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
        onMenuClick={onMenuClick}
        rightContent={
          boardId ? (
            <div className="flex items-center">
              <button
                className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                onClick={() => navigate(`/new-thread/${boardId}`)}
              >
                <span className="material-symbols-outlined text-xl">edit_square</span>
              </button>
              <button
                className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
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

      <div className="flex-1 relative overflow-hidden">
        <div
          ref={listScrollRef}
          className="h-full overflow-y-auto select-none"
          style={{ overscrollBehaviorY: 'contain' }}
          onScroll={handleListScroll}
          onTouchStart={handleListTouchStart}
          onTouchMove={handleListTouchMove}
          onTouchEnd={handleListTouchEnd}
        >
          <div
            ref={listPullIndicatorRef}
            className="flex items-center justify-center text-[10px] text-slate-400 select-none pointer-events-none overflow-hidden"
            style={{ opacity: 0, height: 0 }}
          >
            ↓ 引いて更新
          </div>
          {!boardId ? (
            <div className="p-6 text-center text-slate-500 text-sm">メニューから板を選択してください</div>
          ) : isLoading ? (
            <div className="p-6 text-center text-slate-500 text-sm">読み込み中...</div>
          ) : threads.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-sm">スレッドがありません</div>
          ) : (
            threads.map((thread) => (
              <ThreadCard
                key={thread.id}
                thread={thread}
                isActive={currentThreadId === thread.id}
                isSelected={false}
                compact
                onClick={() => {
                  setHistoryVersion((v) => v + 1)
                  onSelectThread(thread.id)
                }}
              />
            ))
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
        <footer className="flex items-center gap-1 px-1.5 py-1.5 border-t border-c-border bg-c-surface flex-shrink-0">
          {/* 未読フィルタ */}
          <button
            type="button"
            onClick={() => setShowUnread((s) => !s)}
            className={`w-14 py-2 flex items-center justify-center text-[10px] font-bold rounded-lg transition-colors ${
              showUnread
                ? 'bg-c-accent text-[var(--c-accent-text)]'
                : 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800'
            }`}
          >
            未読
          </button>
          {/* ソートボタン（勢い・新着） */}
          {SORT_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setSortMode((m) => (m === mode ? null : mode))}
              className={`w-14 py-2 flex items-center justify-center text-[10px] font-bold rounded-lg transition-colors ${
                sortMode === mode
                  ? 'bg-c-accent text-[var(--c-accent-text)]'
                  : 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800'
              }`}
            >
              {SORT_LABELS[mode]}
            </button>
          ))}
          <div className="flex-1" />
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${isRefreshing ? 'text-c-accent' : 'text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            <span className={`material-symbols-outlined text-xl${isRefreshing ? ' animate-spin' : ''}`}>refresh</span>
          </button>
        </footer>
      )}
    </div>
  )
})

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

  // スワイプ右で閉じる
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const isDraggingRef = useRef(false)

  function handleTouchStart(e: React.TouchEvent) {
    e.stopPropagation()
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() }
    isDraggingRef.current = false
  }

  function handleTouchMove(e: React.TouchEvent) {
    e.stopPropagation()
    if (!touchStartRef.current) return
    const dx = e.touches[0].clientX - touchStartRef.current.x
    const dy = e.touches[0].clientY - touchStartRef.current.y
    if (!isDraggingRef.current) {
      if (Math.abs(dy) > Math.abs(dx) + 5) { touchStartRef.current = null; return }
      if (dx > 8) isDraggingRef.current = true
    }
    if (!isDraggingRef.current || dx <= 0) return
    const panel = panelRef.current
    if (panel) { panel.style.transform = `translateX(${dx}px)`; panel.style.transition = 'none' }
  }

  function handleTouchEnd(e: React.TouchEvent) {
    e.stopPropagation()
    if (!touchStartRef.current || !isDraggingRef.current) {
      touchStartRef.current = null; isDraggingRef.current = false; return
    }
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x
    const dt = Math.max(1, Date.now() - touchStartRef.current.time)
    touchStartRef.current = null; isDraggingRef.current = false
    const panel = panelRef.current
    if (!panel) return
    if (dx > window.innerWidth * 0.4 || (dx > 60 && dx / dt > 0.5)) {
      panel.style.transition = 'transform 250ms ease'
      panel.style.transform = 'translateX(100%)'
      setTimeout(onClose, 250)
    } else {
      panel.style.transition = 'transform 200ms ease'
      panel.style.transform = 'translateX(0)'
    }
  }

  return (
    <div
      ref={panelRef}
      className="absolute inset-0 bg-c-base flex flex-col z-20"
      style={{ willChange: 'transform' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
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

function MobileThreadViewInner({
  boardId,
  threadId,
  onBack,
  onOpenReply,
  handlePostedRef,
}: MobileThreadViewInnerProps) {
  // 履歴からタイトルをキャッシュ（API応答前に即座に表示するため）
  const [cachedTitle] = useState(() => {
    const entry = getHistory().find(e => e.boardId === boardId && e.threadId === threadId)
    return entry?.threadTitle ?? null
  })

  // closeAll を onReply コールバック内から参照するための ref
  const closeAllRef = useRef<() => void>(() => {})

  const {
    thread,
    isLoading,
    filteredPosts,
    anchorCountMap,
    idCountMap,
    ownPostNumbers,
    replyToOwnNumbers,
    firstNewIndex,
    newPostIds: _newPostIds,
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

  function doRefresh() {
    const now = Date.now()
    if (now - lastViewRefreshRef.current < 500) return
    lastViewRefreshRef.current = now
    setIsViewRefreshing(true)
    handleRefresh()
    setTimeout(() => setIsViewRefreshing(false), 500)
  }

  // プルリフレッシュ
  const viewPullStartRef = useRef<{ y: number; atBottom: boolean } | null>(null)
  const viewTopPullRef = useRef<HTMLDivElement>(null)
  const viewBottomPullRef = useRef<HTMLDivElement>(null)
  const VIEW_PULL_THRESHOLD = 70
  const REFRESH_IND_H = 40

  function handleViewTouchStart(e: React.TouchEvent) {
    const el = scrollAreaRef.current
    if (!el) return
    const atTop = el.scrollTop === 0
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 10
    if (!atTop && !atBottom) return
    // コンテンツが短い場合は atTop を優先（下に引いて更新できるように）
    viewPullStartRef.current = { y: e.touches[0].clientY, atBottom: !atTop && atBottom }
  }

  function handleViewTouchMove(e: React.TouchEvent) {
    if (!viewPullStartRef.current) return
    const raw = e.touches[0].clientY - viewPullStartRef.current.y
    const dy = viewPullStartRef.current.atBottom ? -raw : raw
    if (dy <= 0) return
    const progress = Math.min(1, dy / VIEW_PULL_THRESHOLD)
    const h = Math.min(dy * 0.4, REFRESH_IND_H)
    if (viewPullStartRef.current.atBottom) {
      const ind = viewBottomPullRef.current
      if (ind) {
        ind.style.height = `${h}px`
        ind.style.opacity = String(progress * 0.9)
        ind.textContent = progress >= 1 ? '↓ 放すと更新' : '↑ 引いて更新'
      }
    } else {
      const ind = viewTopPullRef.current
      if (ind) {
        ind.style.height = `${h}px`
        ind.style.opacity = String(progress * 0.9)
        ind.textContent = progress >= 1 ? '↑ 放すと更新' : '↓ 引いて更新'
      }
    }
  }

  function handleViewTouchEnd(e: React.TouchEvent) {
    if (!viewPullStartRef.current) return
    const raw = e.changedTouches[0].clientY - viewPullStartRef.current.y
    const atBottom = viewPullStartRef.current.atBottom
    const dy = atBottom ? -raw : raw
    viewPullStartRef.current = null
    const topInd = viewTopPullRef.current
    const botInd = viewBottomPullRef.current
    const activeInd = atBottom ? botInd : topInd
    const inactiveInd = atBottom ? topInd : botInd
    if (inactiveInd) { inactiveInd.style.height = '0'; inactiveInd.style.opacity = '0' }
    if (dy >= VIEW_PULL_THRESHOLD) {
      if (activeInd) {
        activeInd.style.height = `${REFRESH_IND_H}px`
        activeInd.style.opacity = '0.9'
        activeInd.textContent = '更新中...'
        setTimeout(() => { activeInd.style.height = '0'; activeInd.style.opacity = '0' }, 500)
      }
      doRefresh()
    } else {
      if (activeInd) { activeInd.style.height = '0'; activeInd.style.opacity = '0' }
    }
  }

  const scrollToTop = useCallback(() => {
    const el = scrollAreaRef.current
    if (el) el.scrollTop = 0
  }, [scrollAreaRef])

  const scrollToBottom = useCallback(() => {
    const el = scrollAreaRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [scrollAreaRef])

  return (
    <div className="flex flex-col h-full relative">
      {/* トップバー: タイトルタップで先頭へ */}
      <MobileTopBar
        title={thread?.title ?? cachedTitle ?? '読み込み中...'}
        onBack={onBack}
        onTitleClick={scrollToTop}
        rightContent={
          <div className="flex items-center">
            <button
              className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
              onClick={() => setShowSearch((s) => !s)}
            >
              <span className="material-symbols-outlined text-xl">search</span>
            </button>
            <button
              className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
              onClick={() => setShowKebab((s) => !s)}
            >
              <span className="material-symbols-outlined text-xl">more_vert</span>
            </button>
          </div>
        }
      />

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

      {/* フィルターバー（固定幅・コンパクト） */}
      <div className="flex items-center gap-1 px-1.5 py-1 border-b border-c-border bg-c-surface/50 flex-shrink-0">
        {[
          { key: 'popular', label: '人気', icon: 'local_fire_department' },
          { key: 'image',   label: '画像', icon: 'image' },
          { key: 'video',   label: '動画', icon: 'play_circle' },
          { key: 'link',    label: 'リンク', icon: 'link' },
        ].map(({ key, label, icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => toggleFilter(key)}
            className={`w-14 py-1.5 flex items-center justify-center gap-0.5 text-[10px] font-bold rounded-lg transition-colors whitespace-nowrap ${
              postFilters.has(key)
                ? 'bg-c-accent text-[var(--c-accent-text)]'
                : 'text-slate-500 bg-slate-100 dark:bg-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-sm leading-none">{icon}</span>
            {label}
          </button>
        ))}
        {postFilters.size > 0 && (
          <button type="button" onClick={clearFilters} className="text-[10px] text-slate-400 px-1">
            ✕
          </button>
        )}
      </div>

      {/* 投稿リスト */}
      <div className="flex-1 flex overflow-hidden relative">
        <div
          ref={scrollAreaRef}
          onScroll={handleScroll}
          onTouchStart={handleViewTouchStart}
          onTouchMove={handleViewTouchMove}
          onTouchEnd={handleViewTouchEnd}
          className="flex-1 overflow-y-auto custom-scrollbar py-1 space-y-2 [&::-webkit-scrollbar]:w-[4px]"
          style={{ overscrollBehaviorY: 'contain' }}
        >
        {/* 上プルインジケーター（スクロール内に配置してコンテンツを押し下げる） */}
        <div
          ref={viewTopPullRef}
          className="flex items-center justify-center text-[10px] text-slate-400 select-none pointer-events-none overflow-hidden"
          style={{ height: 0, opacity: 0 }}
        />
        {isLoading ? (
          <div className="text-slate-500 text-sm p-4">読み込み中...</div>
        ) : filteredPosts.length === 0 ? (
          <div className="text-slate-500 text-sm p-4">投稿がありません</div>
        ) : (
          filteredPosts.map((post, i) => (
            <Fragment key={post.id}>
              {i === firstNewIndex && (
                <div className="flex items-center gap-2 py-0.5 select-none" style={{ color: 'var(--c-accent)', opacity: 0.6 }}>
                  <div className="flex-1 h-px" style={{ background: 'var(--c-accent)', opacity: 0.4 }} />
                  <span className="text-[9px] font-bold tracking-widest whitespace-nowrap">ここから未読</span>
                  <div className="flex-1 h-px" style={{ background: 'var(--c-accent)', opacity: 0.4 }} />
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
              />
            </Fragment>
          ))
        )}
        {/* 下プルインジケーター */}
        <div
          ref={viewBottomPullRef}
          className="flex items-center justify-center text-[10px] text-slate-400 select-none pointer-events-none overflow-hidden"
          style={{ height: 0, opacity: 0 }}
        />
        </div>
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
        className="flex items-center gap-2 px-2 py-1.5 border-t border-c-border bg-c-surface flex-shrink-0"
        onClick={scrollToBottom}
      >
        <div className="flex-1" />
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); closeAll(); onOpenReply() }}
          className="flex items-center gap-1 px-4 py-2 bg-c-accent hover:opacity-90 text-[var(--c-accent-text)] rounded-xl text-sm font-bold transition-all shadow-md flex-shrink-0"
        >
          <span className="material-symbols-outlined text-lg">edit</span>
          書き込む
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); (e.currentTarget as HTMLButtonElement).blur(); doRefresh() }}
          disabled={isViewRefreshing}
          className={`flex items-center gap-1 px-2 py-1.5 rounded-xl transition-colors text-xs font-bold flex-shrink-0 ${isViewRefreshing ? 'text-c-accent' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'}`}
        >
          <span className={`material-symbols-outlined text-lg${isViewRefreshing ? ' animate-spin' : ''}`}>refresh</span>
          {isViewRefreshing ? '更新中' : '更新'}
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
              onClick={() => { setShowKebab(false); onBack() }}
            >
              <span className="material-symbols-outlined text-lg">arrow_back</span>
              板に戻る
            </button>
            <button
              type="button"
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
              onClick={() => { setShowKebab(false); removeThreadFromHistory(threadId); onBack() }}
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
                  <p className="flex-1 text-sm text-slate-700 dark:text-slate-200 break-all">{thread?.title ?? '読み込み中...'}</p>
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
}

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

  // Panel A 左スワイプ → Panel B 指連動
  const [pendingThreadId, setPendingThreadId] = useState<string | null>(null)
  const panelATouchRef = useRef<{ x: number; y: number; time: number; threadId: string } | null>(null)
  const isPanelADraggingRef = useRef(false)

  function handlePanelATouchStart(e: React.TouchEvent) {
    if (threadId) return  // Panel B は開いているときは無効
    const startX = e.touches[0].clientX
    const startY = e.touches[0].clientY
    const lastEntry = boardId ? getHistory().find((entry) => entry.boardId === boardId) : null
    panelATouchRef.current = { x: startX, y: startY, time: Date.now(), threadId: lastEntry?.threadId ?? '' }
    isPanelADraggingRef.current = false
    if (boardId && lastEntry) {
      // Panel B をプリマウント（空パネル）＆データをプリフェッチ
      setPendingThreadId(lastEntry.threadId)
      void queryClient.prefetchQuery({
        queryKey: ['posts', boardId, lastEntry.threadId],
        queryFn: () => getThreadPosts(boardId, lastEntry.threadId),
      })
    }
  }

  function handlePanelATouchMove(e: React.TouchEvent) {
    if (!panelATouchRef.current) return
    const dx = e.touches[0].clientX - panelATouchRef.current.x
    const dy = e.touches[0].clientY - panelATouchRef.current.y
    if (!isPanelADraggingRef.current) {
      if (Math.abs(dy) > Math.abs(dx) + 5) { panelATouchRef.current = null; setPendingThreadId(null); return }
      if (dx < -8) isPanelADraggingRef.current = true
      else if (dx > 8) return  // 右スワイプ: 視覚フィードバックなしで追跡のみ
    }
    if (!isPanelADraggingRef.current || dx >= 0) return
    const panel = panelBRef.current
    if (panel && panelATouchRef.current.threadId) {
      panel.style.transform = `translateX(${window.innerWidth + dx}px)`
      panel.style.transition = 'none'
    }
  }

  function handlePanelATouchEnd(e: React.TouchEvent) {
    if (!panelATouchRef.current) return
    const dx = e.changedTouches[0].clientX - panelATouchRef.current.x
    const dt = Math.max(1, Date.now() - panelATouchRef.current.time)
    const targetThreadId = panelATouchRef.current.threadId
    panelATouchRef.current = null
    if (!isPanelADraggingRef.current) {
      isPanelADraggingRef.current = false
      setPendingThreadId(null)
      // 右スワイプ → ドロワーを開く
      if (dx > 60 && dx / dt > 0.3) setDrawerOpen(true)
      return
    }
    isPanelADraggingRef.current = false
    const panel = panelBRef.current
    const velocityOk = dx < -60 && Math.abs(dx) / dt > 0.4
    if ((dx < -window.innerWidth * 0.35 || velocityOk) && targetThreadId) {
      if (panel) { panel.style.transition = 'transform 200ms cubic-bezier(0.32, 0.72, 0, 1)'; panel.style.transform = 'translateX(0)' }
      skipNextSlideInRef.current = true
      setTimeout(() => { if (boardId) navigate(`/${boardId}/${targetThreadId}`) }, 200)
    } else {
      if (panel) { panel.style.transition = 'transform 200ms ease'; panel.style.transform = 'translateX(100%)' }
      setTimeout(() => setPendingThreadId(null), 200)
    }
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
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const isDraggingRef = useRef(false)

  function handlePanelTouchStart(e: React.TouchEvent) {
    if (replySheetOpen) return  // 返信パネル開中はスワイプ無効
    const t = e.touches[0]
    touchStartRef.current = { x: t.clientX, y: t.clientY, time: Date.now() }
    isDraggingRef.current = false
  }

  function handlePanelTouchMove(e: React.TouchEvent) {
    if (replySheetOpen) return
    if (!touchStartRef.current) return
    const t = e.touches[0]
    const dx = t.clientX - touchStartRef.current.x
    const dy = t.clientY - touchStartRef.current.y
    if (!isDraggingRef.current) {
      if (Math.abs(dy) > Math.abs(dx) + 5) { touchStartRef.current = null; return }
      if (dx > 8) isDraggingRef.current = true
    }
    if (!isDraggingRef.current || dx <= 0) return
    const panel = panelBRef.current
    if (panel) { panel.style.transform = `translateX(${dx}px)`; panel.style.transition = 'none' }
  }

  function handlePanelTouchEnd(e: React.TouchEvent) {
    if (replySheetOpen) return
    if (!touchStartRef.current || !isDraggingRef.current) {
      touchStartRef.current = null; isDraggingRef.current = false; return
    }
    const t = e.changedTouches[0]
    const dx = t.clientX - touchStartRef.current.x
    const dt = Math.max(1, Date.now() - touchStartRef.current.time)
    touchStartRef.current = null; isDraggingRef.current = false
    const panel = panelBRef.current
    if (!panel) return
    if (dx > window.innerWidth * 0.4 || (dx > 60 && dx / dt > 0.5)) {
      panel.style.transition = 'transform 250ms ease'
      panel.style.transform = 'translateX(100%)'
      setTimeout(() => navigate(boardId ? `/${boardId}` : '/'), 250)
    } else {
      panel.style.transition = 'transform 200ms ease'
      panel.style.transform = 'translateX(0)'
    }
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-c-base text-slate-700 dark:text-slate-200">
      {/* Panel A: スレッド一覧（左スワイプで Panel B を指連動） */}
      <div
        className="absolute inset-0"
        onTouchStart={handlePanelATouchStart}
        onTouchMove={handlePanelATouchMove}
        onTouchEnd={handlePanelATouchEnd}
      >
        <MobileThreadListPanel
          boardId={boardId}
          currentThreadId={threadId}
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
          onTouchMove={handlePanelTouchMove}
          onTouchEnd={handlePanelTouchEnd}
        >
          {threadId ? (
            <>
              <MobileThreadViewInner
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

      {/* 板ドロワー */}
      <MobileBoardDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        currentBoardId={boardId}
      />
    </div>
  )
}
