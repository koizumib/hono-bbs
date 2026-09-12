import { useMemo, useRef, useState, useEffect, useCallback, Fragment } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BoardSidebar from '../components/layout/BoardSidebar'
import ThreadListPanel from '../components/layout/ThreadListPanel'
import { usePosts } from '../hooks/usePosts'
import { useSettingsStore } from '../stores/settingsStore'
import { useAuthStore } from '../stores/authStore'
import { canDo } from '../utils/permissions'
import { filterPosts } from '../utils/filter'
import NgHiddenNotice from '../components/ui/NgHiddenNotice'
import PostArticle, { type PostHandlers } from '../components/post/PostArticle'
import PostPopup, { type PopupEntry } from '../components/post/PostPopup'
import Minimap from '../components/post/Minimap'
import ReplyForm from '../components/post/ReplyForm'
import { parseAnchorsFromContent, buildAnchorTree } from '../utils/anchorParse'
import { recordThreadView, getHistory, saveThreadScrollPosition } from '../utils/threadHistory'
import { extractMedia } from '../utils/urlExtract'
import { fuzzyMatch } from '../utils/fuzzySearch'
import { getPostHistory } from '../utils/postHistory'
import { softDeletePost, reportPost } from '../api/posts'
import { deleteThread, reportThread } from '../api/threads'
import { useWheelPullRefresh } from '../hooks/useWheelPullRefresh'
import PullSpinner from '../components/ui/PullSpinner'
import { PULL_HIDDEN_Y } from '../utils/pullRefresh'

interface ThreadViewProps {
  replyLayout: 'bottom' | 'right'
}

function ThreadView({ replyLayout }: ThreadViewProps) {
  const { boardId, threadId } = useParams()
  const navigate = useNavigate()
  const { data, isLoading, isFetching, isError, refetch } = usePosts(boardId, threadId)
  const userId = useAuthStore((s) => s.userId)
  const ngRules = useSettingsStore((s) => s.ngRules)
  const historyMaxGenerations = useSettingsStore((s) => s.historyMaxGenerations)
  const setReplyLayout = useSettingsStore((s) => s.setReplyLayout)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const lastRefreshRef = useRef(0)
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
  // スレッドを開いた時点の保存済みスクロール進捗（前回どこまで読んでいたかの判定に使う）
  const [initialScrollProgress] = useState<number | null>(() => {
    if (!boardId || !threadId) return null
    const entry = getHistory().find((e) => e.threadId === threadId && e.boardId === boardId)
    return entry?.scrollProgress ?? null
  })

  const [searchQuery, setSearchQuery] = useState('')
  const [shouldScrollNew, setShouldScrollNew] = useState(false)

  // 初回表示位置(スクロール復元/未読ジャンプ)が決まるまでコンテンツを覆っておくための
  // フラグ。これが立つ前にコンテンツをそのまま出すと、先頭が一瞬映ってから
  // 目的の位置へジャンプする「チラつき」が起きてしまう。
  const [positioned, setPositioned] = useState(false)
  // 未読レスを表示するタイミングを、位置決め完了より少し遅らせるためのフラグ。
  // 「まずスレッドを表示 → その後に新着レスを表示」という順序にするため。
  const [newPostsVisible, setNewPostsVisible] = useState(false)

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
  const posts = useMemo(() => filterPosts(rawPosts, ngRules), [rawPosts, ngRules])

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

  const handleRefresh = useCallback(async () => {
    const now = Date.now()
    // クールダウン中(実際には何も取得しない)場合はここで抜ける。ここで無条件に
    // ダイバー位置をリセットすると、実データは何も変わっていないのに「ここから未読」が
    // 消えてしまう(まだ読んでいない新着表示を誤って既読扱いしてしまう)バグになる。
    if (now - lastRefreshRef.current < 5000) return
    lastRefreshRef.current = now
    setReadCountBeforeRefresh(rawPosts.length)
    const atBottom = scrollProgressRef.current >= 0.95
    if (atBottom) setShouldScrollNew(true)
    await refetch()
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

  // 初回ロード時：スクロール位置を復元、または未読レスへジャンプ。
  // usePosts は refetchOnMount:'always' なので、キャッシュ済みスレッドを開いた直後は
  // 「古いレス数のキャッシュ」がまず見え、その裏で最新確認のフェッチが走る。ここで
  // isLoading (=初回データなし)だけを見て判定すると、その古いキャッシュの時点の
  // レス数で「新着なし」と誤判定し、以後ずっとその判定のままになってしまう。その
  // ため isFetching (今まさに取得中かどうか)が終わるのを待ってから判定する。何らかの
  // 理由でフェッチが長引いても画面が永久に固まらないよう、SAFETY_MSを超えたら
  // その時点のデータで確定させる。
  useEffect(() => {
    if (didInitialScrollRef.current) return

    function scrollLastReadToBottom() {
      // 前回読んだ最後のレスが画面下端に来るようにする
      // (新着レスはまだ非表示なので、その手前=既読部分を表示した状態にする)
      const lastReadPost = rawPosts[initialReadCount! - 1]
      const target = lastReadPost ?? rawPosts[initialReadCount!]
      if (target) {
        document
          .getElementById(`post-${target.postNumber}`)
          ?.scrollIntoView({ behavior: 'instant', block: lastReadPost ? 'end' : 'start' })
      }
    }

    // 「ここから未読」の区切りを画面中央付近に置く。ただし、新着レスの量が
    // 少なくスレッドがそこで終わっている場合、そのまま中央寄せしようとすると
    // 実際のコンテンツより下に空白ができてしまう(scrollIntoViewのblock:'center'は
    // 環境によってはこの空白を防いでくれない)ため、実コンテンツの末尾を超えて
    // スクロールしないよう手動でクランプする。
    function centerDividerClamped(el: HTMLDivElement, dividerEl: HTMLElement) {
      const elRect = el.getBoundingClientRect()
      const dividerRect = dividerEl.getBoundingClientRect()
      const dividerOffsetInContent = dividerRect.top - elRect.top + el.scrollTop
      const desired = dividerOffsetInContent - el.clientHeight / 2
      const maxScrollTop = Math.max(0, el.scrollHeight - el.clientHeight)
      el.scrollTop = Math.max(0, Math.min(desired, maxScrollTop))
    }

    function commit() {
      if (didInitialScrollRef.current) return
      didInitialScrollRef.current = true
      const hasNewPosts =
        initialReadCount !== null && initialReadCount > 0 && initialReadCount < rawPosts.length
      if (hasNewPosts) setReadCountBeforeRefresh(initialReadCount)
      setTimeout(() => {
        const el = scrollAreaRef.current
        if (el) {
          // 前回、保存済みスクロール位置がない(=短いスレッドで最後まで表示されていた)
          // か、ほぼ最下部まで読んでいた場合は「読み終えていた」とみなす。
          const wasCaughtUp =
            initialScrollTop === null || (initialScrollProgress ?? 0) >= 0.9
          if (hasNewPosts && wasCaughtUp) {
            // 前回読み終えていたところに新着レスが増えている場合: 新着レスが実際に
            // 見えて発光アニメーションにも気づけるよう、「ここから未読」の区切りが
            // 画面中央付近(＝新着レスが画面下半分を占めるイメージ)に来るようにする
            const dividerEl = document.getElementById('unread-divider')
            if (dividerEl) {
              centerDividerClamped(el, dividerEl)
            } else {
              scrollLastReadToBottom()
            }
          } else if (initialScrollTop !== null && initialScrollTop > 0) {
            // 前回閉じたときのスクロール位置を復元(まだ読み終えていない箇所から再開)
            el.scrollTop = initialScrollTop
          } else if (hasNewPosts) {
            scrollLastReadToBottom()
          }
          scrollTopRef.current = el.scrollTop
        }
        setPositioned(true)
        if (hasNewPosts) {
          setTimeout(() => setNewPostsVisible(true), 400)
        } else {
          setNewPostsVisible(true)
        }
      }, 150)
    }

    if (!isFetching) {
      commit()
      return
    }
    const SAFETY_MS = 6000
    const safety = setTimeout(commit, SAFETY_MS)
    return () => clearTimeout(safety)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFetching, rawPosts])

  // スクロール位置を ref で追跡（onScroll で直接更新）
  const handleScroll = useCallback(() => {
    const el = scrollAreaRef.current
    if (!el) return
    scrollTopRef.current = el.scrollTop
    const max = el.scrollHeight - el.clientHeight
    scrollProgressRef.current = max > 0 ? el.scrollTop / max : 0
  }, [])

  // ホイールオーバースクロールで更新（上端: 上スクロール / 下端: 下スクロール）。
  // スマホのタッチ版と同じ丸矢印アニメーション・最小回転時間を共有し、
  // 1回のホイールイベントでは発火せず、閾値まで累積させる。
  const {
    indicatorRef: topPullIndicatorRef,
    iconRef: topPullIconRef,
    pull: topPull,
    reset: topPullReset,
  } = useWheelPullRefresh({ onRefresh: handleRefresh, sign: 1 })
  const {
    indicatorRef: bottomPullIndicatorRef,
    iconRef: bottomPullIconRef,
    pull: bottomPull,
    reset: bottomPullReset,
  } = useWheelPullRefresh({ onRefresh: handleRefresh, sign: -1 })

  function handleWheelRefresh(e: React.WheelEvent<HTMLDivElement>) {
    const el = scrollAreaRef.current
    if (!el) return
    if (e.deltaY < 0 && el.scrollTop < 1) {
      topPull(-e.deltaY)
      bottomPullReset()
    } else if (e.deltaY > 0 && el.scrollTop + el.clientHeight >= el.scrollHeight - 5) {
      bottomPull(e.deltaY)
      topPullReset()
    } else {
      topPullReset()
      bottomPullReset()
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
    onReport: async (postNumber) => {
      if (!boardId || !threadId) return
      if (!window.confirm(`No.${postNumber} を通報しますか？`)) return
      try {
        await reportPost(boardId, threadId, postNumber)
        window.alert('通報しました')
      } catch {
        window.alert('通報に失敗しました')
      }
    },
    onDelete: async (postNumber) => {
      if (!boardId || !threadId) return
      if (!window.confirm(`No.${postNumber} を削除しますか？`)) return
      try {
        await softDeletePost(boardId, threadId, postNumber)
        refetch()
      } catch {
        window.alert('削除に失敗しました')
      }
    },
  }

  async function handleDeleteThread() {
    if (!boardId || !threadId) return
    if (!window.confirm('このスレッドを削除しますか？ 投稿も全て削除されます。')) return
    try {
      await deleteThread(boardId, threadId)
      navigate(`/${boardId}`)
    } catch {
      window.alert('削除に失敗しました')
    }
  }

  async function handleReportThread() {
    if (!boardId || !threadId) return
    if (!window.confirm('このスレッドを通報しますか？')) return
    try {
      await reportThread(boardId, threadId)
      window.alert('通報しました')
    } catch {
      window.alert('通報に失敗しました')
    }
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
    <div className="flex-1 relative overflow-hidden">
      {/* 上部更新インジケーター（コンテンツの高さを変えず独立して降りてくる） */}
      <div
        className="absolute left-0 right-0 top-0 flex justify-center pointer-events-none z-10"
        style={{ opacity: 0, transform: `translateY(${PULL_HIDDEN_Y}px)` }}
        ref={topPullIndicatorRef}
      >
        <PullSpinner iconRef={topPullIconRef} />
      </div>
      {/* 下部更新インジケーター */}
      <div
        className="absolute left-0 right-0 bottom-0 flex justify-center pointer-events-none z-10"
        style={{ opacity: 0, transform: `translateY(${-PULL_HIDDEN_Y}px)` }}
        ref={bottomPullIndicatorRef}
      >
        <PullSpinner iconRef={bottomPullIconRef} />
      </div>
    <div
      ref={scrollAreaRef}
      onScroll={handleScroll}
      onWheel={handleWheelRefresh}
      className="h-full overflow-y-auto custom-scrollbar p-6 space-y-3"
    >
      {isError && !thread ? (
        <div className="text-slate-500 text-sm">データが取得できませんでした</div>
      ) : isLoading ? (
        <div className="text-slate-500 text-sm">読み込み中...</div>
      ) : filteredPosts.length === 0 ? (
        <div className="text-slate-500 text-sm">投稿がありません</div>
      ) : (
        filteredPosts.map((post, i) => {
          const content = (
            <>
              {i === firstNewIndex && (
                <div
                  id="unread-divider"
                  className="flex items-center gap-3 py-1 select-none"
                  style={{ color: 'var(--c-accent-self)', opacity: 0.6 }}
                >
                  <div className="flex-1 h-px" style={{ background: 'var(--c-accent-self)', opacity: 0.4 }} />
                  <span className="text-[10px] font-bold tracking-widest whitespace-nowrap">
                    ここから未読
                  </span>
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
                showTopDivider={i > 0 && i !== firstNewIndex}
                // newPostsVisible が false の間(初回表示のフェードイン待ち)は
                // まだ画面上で不可視のため、ここでisNewを立てて光らせても意味が
                // ないばかりか、見えるようになる頃にはアニメーションが終わって
                // しまう。実際に見える(newPostsVisible=true)タイミングに合わせて
                // 発火させる。
                isNew={newPostsVisible && newPostIds.has(post.id)}
              />
            </>
          )
          // 未読レスはスレッド表示位置が決まった後、少し遅れてフェードインさせる
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
      <div className="absolute inset-0 z-20 flex items-center justify-center bg-c-base">
        <span className="material-symbols-outlined text-3xl text-slate-400 animate-spin">progress_activity</span>
      </div>
    )}
    </div>
  )

  const header = (
    <header className="h-16 flex-shrink-0 border-b border-c-border bg-c-base/80 backdrop-blur-md shadow-sm flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="min-w-0 flex-1 flex items-center gap-2">
        <h2
          className="font-bold text-slate-900 dark:text-white truncate text-base cursor-pointer hover:text-c-accent transition-colors"
          onClick={() => { const el = scrollAreaRef.current; if (el) el.scrollTop = 0 }}
          title="クリックで先頭へスクロール"
        >
          {thread ? thread.title : '読み込み中...'}
        </h2>
        {thread?.isArchived && (
          <span className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
            dat落ち
          </span>
        )}
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
        {thread && canDo(thread.acl, { userId, userRoleIds: [] }, 'delete') && (
          <button
            className="p-2 text-slate-400 hover:text-red-400 transition-colors"
            title="スレッドを削除"
            onClick={handleDeleteThread}
          >
            <span className="material-symbols-outlined text-xl">delete</span>
          </button>
        )}
        <button
          className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
          title="スレッドを通報"
          onClick={handleReportThread}
        >
          <span className="material-symbols-outlined text-xl">flag</span>
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
    <div className="flex items-center gap-4 px-4 border-b border-c-border bg-c-surface/50 flex-shrink-0 overflow-x-auto no-scrollbar text-sm font-medium">
      <button
        type="button"
        onClick={() => setPostFilters(new Set())}
        className={`relative py-2.5 shrink-0 transition-colors ${
          postFilters.size === 0 ? 'text-c-accent' : 'text-slate-500 dark:text-slate-400'
        }`}
      >
        すべて
        {postFilters.size === 0 && (
          <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-c-accent rounded-full" />
        )}
      </button>
      {[
        { key: 'popular', label: '人気レス', icon: 'local_fire_department' },
        { key: 'image', label: '画像', icon: 'image' },
        { key: 'video', label: '動画', icon: 'play_circle' },
        { key: 'link', label: 'リンク', icon: 'link' },
      ].map(({ key, label, icon }) => {
        const active = postFilters.has(key)
        return (
          <button
            key={key}
            type="button"
            onClick={() => toggleFilter(key)}
            className={`relative py-2.5 shrink-0 flex items-center gap-1 transition-colors whitespace-nowrap ${
              active ? 'text-c-accent' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <span className="material-symbols-outlined text-base leading-none">{icon}</span>
            {label}
            {active && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-c-accent rounded-full" />
            )}
          </button>
        )
      })}
    </div>
  )

  return (
    <main className="flex-1 flex flex-col bg-c-base overflow-hidden">
      {header}
      {filterBar}
      <NgHiddenNotice count={rawPosts.length - posts.length} />

      {replyLayout === 'bottom' ? (
        <>
          <div className="flex flex-1 overflow-hidden">
            {postsArea}
            {filteredPosts.length > 0 && (
              <Minimap posts={filteredPosts} scrollAreaRef={scrollAreaRef} anchorCountMap={anchorCountMap} ownPostNumbers={ownPostNumbers} replyToOwnNumbers={replyToOwnNumbers} />
            )}
          </div>
          <ReplyForm boardId={boardId} threadId={threadId} threadTitle={thread?.title} layout="bottom" insertAnchor={insertAnchor} onPosted={handlePosted} disabled={thread?.isArchived} />
        </>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <div className="flex flex-1 overflow-hidden">
            {postsArea}
            {filteredPosts.length > 0 && (
              <Minimap posts={filteredPosts} scrollAreaRef={scrollAreaRef} anchorCountMap={anchorCountMap} ownPostNumbers={ownPostNumbers} replyToOwnNumbers={replyToOwnNumbers} />
            )}
          </div>
          <ReplyForm boardId={boardId} threadId={threadId} threadTitle={thread?.title} layout="right" insertAnchor={insertAnchor} onPosted={handlePosted} disabled={thread?.isArchived} />
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
