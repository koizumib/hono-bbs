import { useMemo, useRef, useState, useEffect, useCallback, Fragment } from 'react'
import { useParams } from 'react-router-dom'
import BoardSidebar from '../components/layout/BoardSidebar'
import ThreadListPanel from '../components/layout/ThreadListPanel'
import { usePosts } from '../hooks/usePosts'
import { useSettingsStore } from '../stores/settingsStore'
import { filterPosts } from '../utils/filter'
import PostArticle, { type PostHandlers } from '../components/post/PostArticle'
import PostPopup, { type PopupEntry } from '../components/post/PostPopup'
import Minimap from '../components/post/Minimap'
import ReplyForm from '../components/post/ReplyForm'
import { parseAnchorsFromContent, buildAnchorTree } from '../utils/anchorParse'
import { recordThreadView, getHistory, saveThreadScrollPosition } from '../utils/threadHistory'
import { extractMedia } from '../utils/urlExtract'
import { fuzzyMatch } from '../utils/fuzzySearch'
import { getPostHistory } from '../utils/postHistory'

interface ThreadViewProps {
  replyLayout: 'bottom' | 'right'
}

function ThreadView({ replyLayout }: ThreadViewProps) {
  const { boardId, threadId } = useParams()
  const { data, isLoading, refetch } = usePosts(boardId, threadId)
  const ngWords = useSettingsStore((s) => s.ngWords)
  const historyMaxGenerations = useSettingsStore((s) => s.historyMaxGenerations)
  const setReplyLayout = useSettingsStore((s) => s.setReplyLayout)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const pcTopPullRef = useRef<HTMLDivElement>(null)
  const pcBottomPullRef = useRef<HTMLDivElement>(null)
  const lastRefreshRef = useRef(0)
  const REFRESH_IND_H = 40
  const [popups, setPopups] = useState<PopupEntry[]>([])
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null)
  const insertSeqRef = useRef(0)
  const [insertAnchor, setInsertAnchor] = useState<{ text: string; seq: number } | null>(null)
  const [postFilters, setPostFilters] = useState<Set<string>>(new Set())
  // 更新前のレス数（未読ディバイダー表示用）
  const [readCountBeforeRefresh, setReadCountBeforeRefresh] = useState<number | null>(null)

  // スレッドを開いた時点の既読数（recordThreadView で上書きされる前に取得）
  const [initialReadCount] = useState<number | null>(() => {
    if (!boardId || !threadId) return null
    const entry = getHistory().find((e) => e.threadId === threadId && e.boardId === boardId)
    return entry?.lastReadCount ?? null
  })
  const didInitialScrollRef = useRef(false)
  const scrollTopRef = useRef(0)
  const scrollProgressRef = useRef(0)

  // スレッドを開いた時点の保存済みスクロール位置
  const [initialScrollTop] = useState<number | null>(() => {
    if (!boardId || !threadId) return null
    const entry = getHistory().find((e) => e.threadId === threadId && e.boardId === boardId)
    return entry?.lastScrollTop ?? null
  })

  const [searchQuery, setSearchQuery] = useState('')
  const [shouldScrollNew, setShouldScrollNew] = useState(false)

  function toggleFilter(f: string) {
    setPostFilters(prev => {
      const next = new Set(prev)
      if (next.has(f)) next.delete(f)
      else next.add(f)
      return next
    })
  }

  const thread = data?.data.thread
  const rawPosts = data?.data.posts ?? []
  const posts = useMemo(() => filterPosts(rawPosts, ngWords), [rawPosts, ngWords])

  // 自分が書き込んだレスの番号セット（投稿後の refetch で更新）
  const ownPostNumbers = useMemo(() => {
    const history = getPostHistory()
    const set = new Set<number>()
    for (const entry of history) {
      if (entry.boardId === boardId && entry.threadId === threadId && entry.postNumber !== undefined) {
        set.add(entry.postNumber)
      }
    }
    return set
  }, [boardId, threadId, rawPosts.length])

  // 自分のレスに直接アンカーを付けているレスの番号セット
  const replyToOwnNumbers = useMemo(() => {
    if (ownPostNumbers.size === 0) return new Set<number>()
    const set = new Set<number>()
    for (const post of posts) {
      if (ownPostNumbers.has(post.postNumber)) continue
      const anchors = parseAnchorsFromContent(post.content)
      if (anchors.some((n) => ownPostNumbers.has(n))) {
        set.add(post.postNumber)
      }
    }
    return set
  }, [posts, ownPostNumbers])

  useEffect(() => {
    const el = scrollAreaRef.current
    if (!el) return
    const update = () => setContainerRect(el.getBoundingClientRect())
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    window.addEventListener('resize', update)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [posts, replyLayout])

  useEffect(() => {
    if (!data || !boardId || !threadId) return
    const t = data.data.thread
    const board = (data as { data: { board?: { name: string } } }).data.board
    recordThreadView(
      {
        threadId,
        boardId,
        threadTitle: t.title,
        boardName: board?.name ?? boardId,
        lastReadCount: t.postCount,
      },
      historyMaxGenerations,
    )
  }, [data, boardId, threadId, historyMaxGenerations])

  const anchorCountMap = useMemo(() => {
    const map = new Map<number, number>()
    for (const post of posts) {
      const unique = new Set(parseAnchorsFromContent(post.content))
      for (const n of unique) {
        map.set(n, (map.get(n) ?? 0) + 1)
      }
    }
    return map
  }, [posts])

  const idCountMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const post of posts) {
      if (post.authorId) {
        map.set(post.authorId, (map.get(post.authorId) ?? 0) + 1)
      }
    }
    return map
  }, [posts])

  const filteredPosts = useMemo(() => {
    let result = posts
    if (postFilters.size > 0) {
      result = result.filter(post => {
        const media = extractMedia(post.content)
        if (postFilters.has('popular') && (anchorCountMap.get(post.postNumber) ?? 0) >= 3) return true
        if (postFilters.has('image') && media.some(m => m.type === 'image')) return true
        if (postFilters.has('video') && media.some(m => m.type === 'youtube')) return true
        if (postFilters.has('link') && media.some(m => m.type === 'url' || m.type === 'twitter')) return true
        return false
      })
    }
    if (searchQuery.trim()) {
      result = result.filter(p => fuzzyMatch(p.content, searchQuery) || fuzzyMatch(String(p.postNumber), searchQuery))
    }
    return result
  }, [posts, postFilters, anchorCountMap, searchQuery])

  // 更新前のレス数から「ここから未読」の境界IDセットを作る
  const newPostIds = useMemo(() => {
    if (readCountBeforeRefresh === null) return new Set<string>()
    return new Set(rawPosts.slice(readCountBeforeRefresh).map(p => p.id))
  }, [rawPosts, readCountBeforeRefresh])

  const handleRefresh = useCallback(() => {
    const now = Date.now()
    // クールダウン関係なく常にダイバー位置をリセット
    setReadCountBeforeRefresh(rawPosts.length)
    if (now - lastRefreshRef.current < 5000) return
    lastRefreshRef.current = now
    const atBottom = scrollProgressRef.current >= 0.95
    if (atBottom) setShouldScrollNew(true)
    void refetch()
  }, [rawPosts.length, refetch])

  const handlePosted = useCallback(() => {
    setReadCountBeforeRefresh(rawPosts.length)
    setShouldScrollNew(true)
  }, [rawPosts.length])

  // shouldScrollNew が設定されているのに新レスが来ない場合の安全リセット（3秒）
  useEffect(() => {
    if (!shouldScrollNew) return
    const safety = setTimeout(() => setShouldScrollNew(false), 3000)
    return () => clearTimeout(safety)
  }, [shouldScrollNew])

  useEffect(() => {
    if (!shouldScrollNew) return
    if (readCountBeforeRefresh === null || rawPosts.length <= readCountBeforeRefresh) return
    const id = setTimeout(() => {
      const el = scrollAreaRef.current
      if (!el) { setShouldScrollNew(false); return }
      const firstNewPost = rawPosts[readCountBeforeRefresh]
      if (firstNewPost) {
        const targetEl = document.getElementById(`post-${firstNewPost.postNumber}`)
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'instant', block: 'start' })
          setShouldScrollNew(false)
          return
        }
      }
      el.scrollTo({ top: el.scrollHeight, behavior: 'instant' })
      setShouldScrollNew(false)
    }, 300)
    return () => clearTimeout(id)
  }, [rawPosts, shouldScrollNew, readCountBeforeRefresh])

  // 初回ロード時：スクロール位置を復元、または未読レスへジャンプ
  useEffect(() => {
    if (didInitialScrollRef.current) return
    if (rawPosts.length === 0) return
    didInitialScrollRef.current = true
    const hasNewPosts =
      initialReadCount !== null && initialReadCount > 0 && initialReadCount < rawPosts.length
    if (hasNewPosts) setReadCountBeforeRefresh(initialReadCount)
    const id = setTimeout(() => {
      const el = scrollAreaRef.current
      if (!el) return
      if (initialScrollTop !== null && initialScrollTop > 0) {
        el.scrollTop = initialScrollTop
        scrollTopRef.current = el.scrollTop
      } else if (hasNewPosts) {
        const target = rawPosts[initialReadCount!]
        if (target) {
          document
            .getElementById(`post-${target.postNumber}`)
            ?.scrollIntoView({ behavior: 'instant', block: 'start' })
        }
      }
    }, 150)
    return () => clearTimeout(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawPosts])

  // スクロール位置を ref で追跡（onScroll で直接更新）
  const handleScroll = useCallback(() => {
    const el = scrollAreaRef.current
    if (!el) return
    scrollTopRef.current = el.scrollTop
    const max = el.scrollHeight - el.clientHeight
    scrollProgressRef.current = max > 0 ? el.scrollTop / max : 0
  }, [])

  function showPcRefreshIndicator(dir: 'top' | 'bottom') {
    const ind = dir === 'top' ? pcTopPullRef.current : pcBottomPullRef.current
    if (!ind) return
    const currentH = parseInt(ind.style.height) || 0
    if (currentH > 0) return
    ind.style.height = `${REFRESH_IND_H}px`
    ind.style.opacity = '0.9'
    setTimeout(() => { ind.style.height = '0'; ind.style.opacity = '0' }, 500)
  }

  // ホイールオーバースクロールで更新（上端: 上スクロール / 下端: 下スクロール）
  function handleWheelRefresh(e: React.WheelEvent<HTMLDivElement>) {
    const el = scrollAreaRef.current
    if (!el) return
    if (e.deltaY < 0 && el.scrollTop < 1) {
      showPcRefreshIndicator('top')
      handleRefresh()
    } else if (e.deltaY > 0 && el.scrollTop + el.clientHeight >= el.scrollHeight - 5) {
      showPcRefreshIndicator('bottom')
      handleRefresh()
    }
  }

  // スレッド離脱時にスクロール位置を保存
  useEffect(() => {
    return () => {
      if (boardId && threadId && scrollTopRef.current > 0) {
        saveThreadScrollPosition(boardId, threadId, scrollTopRef.current, scrollProgressRef.current)
      }
    }
  }, [boardId, threadId])

  // F5 / Ctrl+R でスレッドを更新（スレッド表示時のみ）
  useEffect(() => {
    if (!boardId || !threadId) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key === 'r')) {
        e.preventDefault()
        handleRefresh()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [boardId, threadId, handleRefresh])

  function openPopup(entry: Omit<PopupEntry, 'id'>) {
    setPopups((prev) => [...prev, { ...entry, id: crypto.randomUUID() }])
  }

  function closeTop() {
    setPopups((prev) => prev.slice(0, -1))
  }

  function closeAll() {
    setPopups([])
  }

  const handlers: PostHandlers = {
    onAnchorClick: (numbers, triggerY) => {
      const matched = posts.filter((p) => numbers.includes(p.postNumber))
      const title = numbers.map((n) => `>>${n}`).join(' ')
      openPopup({ title, posts: matched, triggerY })
    },
    onBadgeClick: (postNumber, triggerY) => {
      const repliers = posts.filter((p) =>
        parseAnchorsFromContent(p.content).includes(postNumber),
      )
      openPopup({
        title: `>>${postNumber} へのレス (${repliers.length}件)`,
        posts: repliers,
        triggerY,
      })
    },
    onIdClick: (id, triggerY) => {
      const idPosts = posts.filter((p) => p.authorId === id)
      openPopup({ title: `ID:${id} (${idPosts.length}件)`, posts: idPosts, triggerY })
    },
    onNameClick: (name, triggerY) => {
      const namePosts = posts.filter((p) => p.posterName === name)
      openPopup({ title: `${name} (${namePosts.length}件)`, posts: namePosts, triggerY })
    },
    onBodyClick: (postNumber, triggerY) => {
      const treeNumbers = buildAnchorTree(postNumber, posts)
      if (treeNumbers.length <= 1) return
      const treePosts = posts
        .filter((p) => treeNumbers.includes(p.postNumber))
        .sort((a, b) => a.postNumber - b.postNumber)
      openPopup({ title: `>>${postNumber} のアンカーツリー`, posts: treePosts, triggerY })
    },
    onReply: (postNumber) => {
      insertSeqRef.current += 1
      setInsertAnchor({ text: String(postNumber), seq: insertSeqRef.current })
    },
  }

  if (!boardId || !threadId) {
    return (
      <main className="flex-1 flex items-center justify-center bg-c-base">
        <div className="text-slate-600 text-sm">スレッドを選択してください</div>
      </main>
    )
  }

  // 未読ディバイダーの挿入位置（filteredPosts内で最初の新規レスのインデックス）
  const firstNewIndex = newPostIds.size > 0
    ? filteredPosts.findIndex(p => newPostIds.has(p.id))
    : -1

  const postsArea = (
    <div
      ref={scrollAreaRef}
      onScroll={handleScroll}
      onWheel={handleWheelRefresh}
      className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6"
    >
      {/* 上部更新インジケーター */}
      <div
        ref={pcTopPullRef}
        className="flex items-center justify-center text-xs text-slate-400 select-none pointer-events-none overflow-hidden"
        style={{ height: 0, opacity: 0 }}
      >
        更新中...
      </div>
      {isLoading ? (
        <div className="text-slate-500 text-sm">読み込み中...</div>
      ) : filteredPosts.length === 0 ? (
        <div className="text-slate-500 text-sm">投稿がありません</div>
      ) : (
        filteredPosts.map((post, i) => (
          <Fragment key={post.id}>
            {i === firstNewIndex && (
              <div
                className="flex items-center gap-3 py-1 select-none"
                style={{ color: 'var(--c-accent)', opacity: 0.6 }}
              >
                <div className="flex-1 h-px" style={{ background: 'var(--c-accent)', opacity: 0.4 }} />
                <span className="text-[10px] font-bold tracking-widest whitespace-nowrap">
                  ここから未読
                </span>
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
              showTopDivider={i > 0 && i !== firstNewIndex}
            />
          </Fragment>
        ))
      )}
      {/* 下部更新インジケーター */}
      <div
        ref={pcBottomPullRef}
        className="flex items-center justify-center text-xs text-slate-400 select-none pointer-events-none overflow-hidden"
        style={{ height: 0, opacity: 0 }}
      >
        更新中...
      </div>
    </div>
  )

  const header = (
    <header className="h-16 flex-shrink-0 border-b border-c-border bg-c-base/80 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="min-w-0 flex-1">
        <h2
          className="font-bold text-slate-900 dark:text-white truncate text-base cursor-pointer hover:text-c-accent transition-colors"
          onClick={() => { const el = scrollAreaRef.current; if (el) el.scrollTop = 0 }}
          title="クリックで先頭へスクロール"
        >
          {thread ? thread.title : '読み込み中...'}
        </h2>
      </div>
      <div className="flex items-center gap-2 ml-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="レス検索..."
          className="bg-c-surface2 border border-c-border rounded-lg px-2 py-1 text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-c-accent/50 w-32"
        />
        <button
          className={`p-2 transition-colors rounded-lg ${replyLayout === 'right' ? 'text-c-accent bg-c-accent/10' : 'text-slate-400 hover:text-slate-700 dark:hover:text-white'}`}
          title={replyLayout === 'right' ? '書き込みパネル: 右側' : '書き込みパネル: 下部'}
          onClick={() => setReplyLayout(replyLayout === 'bottom' ? 'right' : 'bottom')}
        >
          <span className="material-symbols-outlined text-xl">
            {replyLayout === 'right' ? 'view_sidebar' : 'view_agenda'}
          </span>
        </button>
        <button
          className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
          title="更新"
          onClick={handleRefresh}
        >
          <span className="material-symbols-outlined text-xl">refresh</span>
        </button>
      </div>
    </header>
  )

  const filterBar = (
    <div className="flex gap-1.5 px-4 py-2 border-b border-c-border bg-c-surface/50 flex-shrink-0">
      {[
        { key: 'popular', label: '人気レス', icon: 'local_fire_department' },
        { key: 'image', label: '画像', icon: 'image' },
        { key: 'video', label: '動画', icon: 'play_circle' },
        { key: 'link', label: 'リンク', icon: 'link' },
      ].map(({ key, label, icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => toggleFilter(key)}
          className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-lg transition-colors ${
            postFilters.has(key)
              ? 'bg-c-accent text-[var(--c-accent-text)]'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 bg-slate-100 dark:bg-slate-800'
          }`}
        >
          <span className="material-symbols-outlined text-sm leading-none">{icon}</span>
          {label}
        </button>
      ))}
      {postFilters.size > 0 && (
        <button
          type="button"
          onClick={() => setPostFilters(new Set())}
          className="ml-auto text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        >
          クリア
        </button>
      )}
    </div>
  )

  return (
    <main className="flex-1 flex flex-col bg-c-base overflow-hidden">
      {header}
      {filterBar}

      {replyLayout === 'bottom' ? (
        <>
          <div className="flex flex-1 overflow-hidden">
            {postsArea}
            {filteredPosts.length > 0 && (
              <Minimap posts={filteredPosts} scrollAreaRef={scrollAreaRef} anchorCountMap={anchorCountMap} ownPostNumbers={ownPostNumbers} replyToOwnNumbers={replyToOwnNumbers} />
            )}
          </div>
          <ReplyForm boardId={boardId} threadId={threadId} threadTitle={thread?.title} layout="bottom" insertAnchor={insertAnchor} onPosted={handlePosted} />
        </>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <div className="flex flex-1 overflow-hidden">
            {postsArea}
            {filteredPosts.length > 0 && (
              <Minimap posts={filteredPosts} scrollAreaRef={scrollAreaRef} anchorCountMap={anchorCountMap} ownPostNumbers={ownPostNumbers} replyToOwnNumbers={replyToOwnNumbers} />
            )}
          </div>
          <ReplyForm boardId={boardId} threadId={threadId} threadTitle={thread?.title} layout="right" insertAnchor={insertAnchor} onPosted={handlePosted} />
        </div>
      )}

      <PostPopup
        popups={popups}
        containerRect={containerRect}
        anchorCountMap={anchorCountMap}
        idCountMap={idCountMap}
        handlers={handlers}
        onCloseTop={closeTop}
        onCloseAll={closeAll}
      />
    </main>
  )
}

export default function MainBoardPage() {
  const { threadId } = useParams()
  const replyLayout = useSettingsStore((s) => s.replyLayout)

  return (
    <div className="flex h-full w-full overflow-hidden bg-c-base text-slate-700 dark:text-slate-200">
      <BoardSidebar />
      <ThreadListPanel />
      <ThreadView key={threadId ?? 'none'} replyLayout={replyLayout} />
    </div>
  )
}
