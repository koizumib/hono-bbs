import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Post } from '../../api/types'
import PostArticle, { type PostHandlers } from './PostArticle'

export interface PopupEntry {
  id: string
  title: string
  posts: Post[]
  triggerY: number
}

interface PopupWindowProps {
  entry: PopupEntry
  stackIndex: number
  containerRect: DOMRect | null
  anchorCountMap: Map<number, number>
  idCountMap: Map<string, number>
  handlers: PostHandlers
  hideTitle?: boolean
  compact?: boolean
  isTop: boolean
  onCloseAll: () => void
}

function PopupWindow({
  entry,
  stackIndex,
  containerRect,
  anchorCountMap,
  idCountMap,
  handlers,
  hideTitle,
  compact,
  isTop,
  onCloseAll,
}: PopupWindowProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<React.CSSProperties>({
    position: 'fixed',
    visibility: 'hidden',
    left: containerRect ? containerRect.left : window.innerWidth / 2 - 300,
    width: containerRect ? containerRect.width : 600,
    maxWidth: '100vw',
    zIndex: 9001 + stackIndex,
  })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const height = el.scrollHeight
    const left = containerRect ? containerRect.left : window.innerWidth / 2 - Math.min(600, window.innerWidth - 32) / 2
    const width = containerRect ? containerRect.width : Math.min(600, window.innerWidth - 32)
    const minTop = containerRect ? containerRect.top : 64
    const maxAvailableHeight = containerRect ? containerRect.height * 0.95 : window.innerHeight * 0.85
    const spaceAbove = entry.triggerY - minTop

    let top: number
    let maxHeight: string
    if (height <= spaceAbove) {
      top = entry.triggerY - height
      maxHeight = `${spaceAbove}px`
    } else {
      top = minTop
      maxHeight = `${maxAvailableHeight}px`
    }

    setStyle({
      position: 'fixed',
      visibility: 'visible',
      left,
      width,
      maxWidth: '100vw',
      top,
      maxHeight,
      overflowY: 'auto',
      zIndex: 9001 + stackIndex,
      // 最前面以外はタッチ・クリックを透過して背面オーバーレイに届かせる
      pointerEvents: isTop ? 'auto' : 'none',
    })
  }, [entry.triggerY, entry.posts, containerRect, stackIndex, isTop])

  // タッチスワイプ検出（水平スワイプ → 全ポップアップ閉じる）
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  function handleTouchStart(e: React.TouchEvent) {
    e.stopPropagation()
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }

  function handleTouchMove(e: React.TouchEvent) {
    e.stopPropagation()
  }

  function handleTouchEnd(e: React.TouchEvent) {
    e.stopPropagation()
    if (!touchStartRef.current) return
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y
    touchStartRef.current = null
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      onCloseAll()
    }
  }

  return (
    <div
      ref={ref}
      className="bg-c-surface border-2 rounded-xl shadow-2xl custom-scrollbar"
      style={{ ...style, borderColor: 'var(--c-accent)' }}
      onWheel={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {!hideTitle && (
        <div className="px-4 py-3 border-b border-c-border sticky top-0 bg-c-surface z-10">
          <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{entry.title}</span>
        </div>
      )}
      <div className={compact ? 'px-1 py-1 space-y-2' : 'p-4 space-y-4'}>
        {entry.posts.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-4">投稿が見つかりません</p>
        ) : (
          entry.posts.map((post, index) => (
            <PostArticle
              key={post.id}
              post={post}
              anchorCount={anchorCountMap.get(post.postNumber) ?? 0}
              idCount={idCountMap.get(post.authorId) ?? 1}
              handlers={handlers}
              isInPopup
              compact={compact}
              showTopDivider={index > 0}
            />
          ))
        )}
      </div>
    </div>
  )
}

interface PostPopupProps {
  popups: PopupEntry[]
  containerRect: DOMRect | null
  anchorCountMap: Map<number, number>
  idCountMap: Map<string, number>
  handlers: PostHandlers
  onCloseTop: () => void
  onCloseAll: () => void
  hideTitle?: boolean
  compact?: boolean
}

export default function PostPopup({
  popups,
  containerRect,
  anchorCountMap,
  idCountMap,
  handlers,
  onCloseTop,
  onCloseAll,
  hideTitle,
  compact,
}: PostPopupProps) {
  // オーバーレイ背面のタッチスワイプ検出
  const overlayTouchStartRef = useRef<{ x: number; y: number } | null>(null)

  function handleOverlayTouchStart(e: React.TouchEvent) {
    e.stopPropagation()
    overlayTouchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }

  function handleOverlayTouchMove(e: React.TouchEvent) {
    e.stopPropagation()
  }

  function handleOverlayTouchEnd(e: React.TouchEvent) {
    e.stopPropagation()
    if (!overlayTouchStartRef.current) return
    const dx = e.changedTouches[0].clientX - overlayTouchStartRef.current.x
    const dy = e.changedTouches[0].clientY - overlayTouchStartRef.current.y
    overlayTouchStartRef.current = null
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      onCloseAll()
    }
  }

  if (popups.length === 0) return null

  return createPortal(
    <div
      className="fixed inset-0"
      style={{ zIndex: 9000 }}
      onClick={onCloseTop}
      onWheel={() => onCloseAll()}
      onTouchStart={handleOverlayTouchStart}
      onTouchMove={handleOverlayTouchMove}
      onTouchEnd={handleOverlayTouchEnd}
    >
      {popups.map((entry, index) => (
        <PopupWindow
          key={entry.id}
          entry={entry}
          stackIndex={index}
          containerRect={containerRect}
          anchorCountMap={anchorCountMap}
          idCountMap={idCountMap}
          handlers={handlers}
          hideTitle={hideTitle}
          compact={compact}
          isTop={index === popups.length - 1}
          onCloseAll={onCloseAll}
        />
      ))}
    </div>,
    document.body,
  )
}
