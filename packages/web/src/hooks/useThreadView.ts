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
import { reportPost } from '../api/posts'

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
  const { data, isLoading, isFetching, isError, refetch } = usePosts(boardId, threadId)
  const ngRules = useSettingsStore((s) => s.ngRules)
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
  // 未読レス(前回の続きから新しく増えた分)を表示するタイミングを、位置決め完了より
  // 少し遅らせるためのフラグ。「まずスレッドを表示 → その後に新着レスを表示」という
  // 順序にするため。
  const [newPostsVisible, setNewPostsVisible] = useState(false)

  const thread = data?.data.thread
  const rawPosts = data?.data.posts ?? []
  const posts = useMemo(() => filterPosts(rawPosts, ngRules), [rawPosts, ngRules])

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

  // 呼び出し側(プルリフレッシュ)が実際の完了タイミングを待てるように、refetchのPromiseを返す
  const handleRefresh = useCallback(() => {
    const now = Date.now()
    // クールダウン中(実際には何も取得しない)場合はここで抜ける。ここで無条件に
    // ダイバー位置をリセットすると、実データは何も変わっていないのに「ここから未読」が
    // 消えてしまう(まだ読んでいない新着表示を誤って既読扱いしてしまう)バグになる。
    if (now - lastRefreshRef.current < 5000) return Promise.resolve()
    lastRefreshRef.current = now
    setReadCountBeforeRefresh(rawPosts.length)
    const atBottom = scrollProgressRef.current >= 0.95
    if (atBottom) setShouldScrollNew(true)
    return refetch()
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
  // usePosts は refetchOnMount:'always' なので、キャッシュ済みスレッドを開いた
  // 直後は「古いレス数のキャッシュ」がまず見え、その裏で最新確認のフェッチが走る。
  // ここで isLoading (=初回データなし) だけを見て判定すると、その古いキャッシュの
  // 時点のレス数で「新着なし」と誤判定し、以後ずっとその判定のままになってしまう。
  // そのため isFetching (今まさに取得中かどうか)が終わるのを待ってから判定する。
  // 何らかの理由でフェッチが長引いても画面が永久に固まらないよう、SAFETY_MSを
  // 超えたらその時点のデータで確定させる。
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
        initialReadCount !== null &&
        initialReadCount > 0 &&
        initialReadCount < rawPosts.length
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
          // scrollTop 直接セットや scrollIntoView はスクロールイベントを発火しない
          // 場合があるため ref も更新しておく
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
  }

  const firstNewIndex =
    newPostIds.size > 0 ? filteredPosts.findIndex((p) => newPostIds.has(p.id)) : -1

  return {
    thread,
    isLoading,
    isError,
    filteredPosts,
    ngHiddenCount: rawPosts.length - posts.length,
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
