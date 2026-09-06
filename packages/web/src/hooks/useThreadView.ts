import { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import { usePosts } from './usePosts'
import { useSettingsStore } from '../stores/settingsStore'
import { filterPosts } from '../utils/filter'
import type { PostHandlers } from '../components/post/PostArticle'
import type { PopupEntry } from '../components/post/PostPopup'
import { parseAnchorsFromContent, buildAnchorTree } from '../utils/anchorParse'
import { recordThreadView, getHistory, saveThreadScrollPosition } from '../utils/threadHistory'
import { extractMedia } from '../utils/urlExtract'
import { fuzzyMatch } from '../utils/fuzzySearch'
import { getPostHistory } from '../utils/postHistory'

interface UseThreadViewOptions {
  /** 返信ボタン押下時の追加コールバック（モバイルで返信シートを開くなど） */
  onReply?: (postNumber: number) => void
}

/**
 * ThreadView のデータロジックを抽出したフック。
 * PC版 ThreadView・モバイル版 MobileThreadViewPanel の両方で使用する。
 */
export function useThreadView(
  boardId: string | undefined,
  threadId: string | undefined,
  options?: UseThreadViewOptions,
) {
  const { data, isLoading, refetch } = usePosts(boardId, threadId)
  const ngWords = useSettingsStore((s) => s.ngWords)
  const historyMaxGenerations = useSettingsStore((s) => s.historyMaxGenerations)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const lastRefreshRef = useRef(0)
  const [popups, setPopups] = useState<PopupEntry[]>([])
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null)
  const insertSeqRef = useRef(0)
  const [insertAnchor, setInsertAnchor] = useState<{ text: string; seq: number } | null>(null)
  const [postFilters, setPostFilters] = useState<Set<string>>(new Set())
  const [readCountBeforeRefresh, setReadCountBeforeRefresh] = useState<number | null>(null)
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

  const thread = data?.data.thread
  const rawPosts = data?.data.posts ?? []
  const posts = useMemo(() => filterPosts(rawPosts, ngWords), [rawPosts, ngWords])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ownPostNumbers = useMemo(() => {
    const history = getPostHistory()
    const set = new Set<number>()
    for (const entry of history) {
      if (
        entry.boardId === boardId &&
        entry.threadId === threadId &&
        entry.postNumber !== undefined
      ) {
        set.add(entry.postNumber)
      }
    }
    return set
  // rawPosts.length を dep に含めることで投稿後に再計算させる
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, threadId, rawPosts.length])

  const replyToOwnNumbers = useMemo(() => {
    if (ownPostNumbers.size === 0) return new Set<number>()
    const set = new Set<number>()
    for (const post of posts) {
      if (ownPostNumbers.has(post.postNumber)) continue
      const anchors = parseAnchorsFromContent(post.content)
      if (anchors.some((n) => ownPostNumbers.has(n))) set.add(post.postNumber)
    }
    return set
  }, [posts, ownPostNumbers])

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
      for (const n of unique) map.set(n, (map.get(n) ?? 0) + 1)
    }
    return map
  }, [posts])

  const idCountMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const post of posts) {
      if (post.authorId)
        map.set(post.authorId, (map.get(post.authorId) ?? 0) + 1)
    }
    return map
  }, [posts])

  const filteredPosts = useMemo(() => {
    let result = posts
    if (postFilters.size > 0) {
      result = result.filter((post) => {
        const media = extractMedia(post.content)
        if (postFilters.has('popular') && (anchorCountMap.get(post.postNumber) ?? 0) >= 3)
          return true
        if (postFilters.has('image') && media.some((m) => m.type === 'image')) return true
        if (postFilters.has('video') && media.some((m) => m.type === 'youtube')) return true
        if (
          postFilters.has('link') &&
          media.some((m) => m.type === 'url' || m.type === 'twitter')
        )
          return true
        return false
      })
    }
    if (searchQuery.trim()) {
      result = result.filter(
        (p) =>
          fuzzyMatch(p.content, searchQuery) ||
          fuzzyMatch(String(p.postNumber), searchQuery),
      )
    }
    return result
  }, [posts, postFilters, anchorCountMap, searchQuery])

  const newPostIds = useMemo(() => {
    if (readCountBeforeRefresh === null) return new Set<string>()
    return new Set(rawPosts.slice(readCountBeforeRefresh).map((p) => p.id))
  }, [rawPosts, readCountBeforeRefresh])

  const handleRefresh = useCallback(() => {
    const now = Date.now()
    // クールダウン関係なく常にダイバー位置をリセット（「ここから未読」が古い位置に残らないように）
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
      initialReadCount !== null &&
      initialReadCount > 0 &&
      initialReadCount < rawPosts.length
    if (hasNewPosts) setReadCountBeforeRefresh(initialReadCount)
    const id = setTimeout(() => {
      const el = scrollAreaRef.current
      if (!el) return
      if (initialScrollTop !== null && initialScrollTop > 0) {
        // 前回閉じたときのスクロール位置を復元
        el.scrollTop = initialScrollTop
        // scrollTop 直接セットはスクロールイベントを発火しない場合があるため ref も更新
        scrollTopRef.current = el.scrollTop
      } else if (hasNewPosts) {
        // 未読レスの先頭へジャンプ
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

  // スクロール位置を ref で追跡（onScroll ハンドラを返して消費側で直接アタッチ）
  const handleScroll = useCallback(() => {
    const el = scrollAreaRef.current
    if (!el) return
    scrollTopRef.current = el.scrollTop
    const max = el.scrollHeight - el.clientHeight
    scrollProgressRef.current = max > 0 ? el.scrollTop / max : 0
  }, [])

  // アンマウント時（スレッド離脱時）にスクロール位置を履歴に保存
  useEffect(() => {
    return () => {
      if (boardId && threadId && scrollTopRef.current > 0) {
        saveThreadScrollPosition(boardId, threadId, scrollTopRef.current, scrollProgressRef.current)
      }
    }
  }, [boardId, threadId])

  const optionsRef = useRef(options)
  optionsRef.current = options

  function openPopup(entry: Omit<PopupEntry, 'id'>) {
    // popup 表示直前に containerRect を再計測（モバイルスライドアニメーション後の位置ズレ対策）
    if (scrollAreaRef.current) {
      setContainerRect(scrollAreaRef.current.getBoundingClientRect())
    }
    setPopups((prev) => [...prev, { ...entry, id: crypto.randomUUID() }])
  }

  function closeTop() {
    setPopups((prev) => prev.slice(0, -1))
  }

  function closeAll() {
    setPopups([])
  }

  function toggleFilter(f: string) {
    setPostFilters((prev) => {
      const next = new Set(prev)
      if (next.has(f)) next.delete(f)
      else next.add(f)
      return next
    })
  }

  function clearFilters() {
    setPostFilters(new Set())
  }

  const handlers: PostHandlers = {
    onAnchorClick: (numbers, triggerY) => {
      const matched = posts.filter((p) => numbers.includes(p.postNumber))
      openPopup({ title: numbers.map((n) => `>>${n}`).join(' '), posts: matched, triggerY })
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
      optionsRef.current?.onReply?.(postNumber)
    },
  }

  const firstNewIndex =
    newPostIds.size > 0 ? filteredPosts.findIndex((p) => newPostIds.has(p.id)) : -1

  return {
    thread,
    isLoading,
    filteredPosts,
    anchorCountMap,
    idCountMap,
    ownPostNumbers,
    replyToOwnNumbers,
    firstNewIndex,
    newPostIds,
    scrollAreaRef,
    handleScroll,
    popups,
    containerRect,
    insertAnchor,
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
  }
}
