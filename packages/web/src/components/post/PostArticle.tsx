import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import type { Post } from '../../api/types'
import { fullDateTime } from '../../utils/formatDate'
import { tokenizeContent, parseAnchorsFromContent } from '../../utils/anchorParse'
import { extractMedia, getYouTubeVideoId } from '../../utils/urlExtract'
import { heatClass } from '../../utils/heatColor'
import { env } from '../../config/env'

export interface PostHandlers {
  onAnchorClick: (numbers: number[], triggerY: number) => void
  onBadgeClick: (postNumber: number, triggerY: number) => void
  onIdClick: (id: string, triggerY: number) => void
  onNameClick: (name: string, triggerY: number) => void
  onBodyClick: (postNumber: number, triggerY: number) => void
  onReply: (postNumber: number) => void
}

interface PostArticleProps {
  post: Post
  anchorCount: number
  idCount: number
  handlers: PostHandlers
  isInPopup?: boolean
  isOwnPost?: boolean
  isReplyToOwn?: boolean
  compact?: boolean
  showTopDivider?: boolean
}

const LINK_COLORS = {
  image:   'text-c-link-image hover:text-c-link-image-hover',
  twitter: 'text-c-link-twitter hover:text-c-link-twitter-hover',
  youtube: 'text-c-link-youtube hover:text-c-link-youtube-hover',
  url:     'text-c-link-url hover:text-c-link-url-hover',
} as const

function idColorClass(count: number): string {
  if (count >= 7) return 'text-c-id-very-hot font-bold'
  if (count >= 5) return 'text-c-id-hot font-bold'
  if (count >= 3) return 'text-c-id-warm'
  if (count === 1) return 'text-c-id-first'
  return 'text-c-id-default'
}

export default function PostArticle({
  post,
  anchorCount,
  idCount,
  handlers,
  isInPopup,
  isOwnPost = false,
  isReplyToOwn = false,
  compact = false,
  showTopDivider = false,
}: PostArticleProps) {
  const [lightboxImages, setLightboxImages] = useState<string[]>([])
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const lbTouchStartXRef = useRef<number | null>(null)

  const lbNext = () =>
    setLightboxIndex((prev) =>
      prev !== null ? (prev + 1) % lightboxImages.length : 0,
    )
  const lbPrev = () =>
    setLightboxIndex((prev) =>
      prev !== null ? (prev - 1 + lightboxImages.length) % lightboxImages.length : 0,
    )

  useEffect(() => {
    if (lightboxIndex === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') lbNext()
      else if (e.key === 'ArrowLeft') lbPrev()
      else if (e.key === 'Escape') setLightboxIndex(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxIndex, lightboxImages.length])

  // 半角スペース・タブ・全角スペースが5文字以上連続していればAAと判定
  const isAAContent = /[ \t\u3000]{5,}/i.test(post.content)

  const aaRef = useRef<HTMLParagraphElement>(null)

  // AA表示: PC は横スクロール、スマホ (compact) はフォントサイズ縮小して収める
  useLayoutEffect(() => {
    if (!isAAContent) return
    const p = aaRef.current
    if (!p) return
    p.style.fontSize = ''
    p.style.whiteSpace = 'pre'
    p.style.overflowWrap = ''
    p.style.overflowX = ''
    const containerWidth = (p.parentElement?.clientWidth ?? 0) - 4
    if (containerWidth <= 0 || p.scrollWidth <= containerWidth) return
    if (!compact) {
      // PC: 横スクロール
      p.style.overflowX = 'auto'
      return
    }
    // スマホ: フォントサイズ縮小
    const base = parseFloat(getComputedStyle(p).fontSize)
    const newSize = Math.max(1, Math.floor(base * (containerWidth / p.scrollWidth)))
    if (newSize < base) p.style.fontSize = `${newSize}px`
    // それでも収まらなければ折り返しにフォールバック
    if (p.scrollWidth > containerWidth) {
      p.style.whiteSpace = 'pre-wrap'
      p.style.overflowWrap = 'break-word'
    }
  }, [isAAContent, post.content, compact])

  const isDeleted = post.isDeleted || post.content.startsWith('\x00') || post.content === '[削除済み]'
  const displayName = isDeleted && env.deletedPostName ? env.deletedPostName : post.posterName
  const displayAuthorId = isDeleted && env.deletedPostId ? env.deletedPostId : post.authorId
  const displayContent = isDeleted && env.deletedPostBody ? env.deletedPostBody : post.content
  const numHeat = heatClass(anchorCount)
  const outgoingAnchors = parseAnchorsFromContent(post.content)
  const hasConnections = outgoingAnchors.length > 0 || anchorCount > 0

  const media = extractMedia(displayContent)
  const imageUrls = media.filter((m) => m.type === 'image').map((m) => m.url)
  const youtubeItems = media.filter((m) => m.type === 'youtube')

  function getTriggerY(e: React.MouseEvent): number {
    return (e.currentTarget as HTMLElement).getBoundingClientRect().top
  }

  function handleBodyClick(e: React.MouseEvent) {
    if (window.getSelection()?.toString().trim()) return
    if (!hasConnections) return
    handlers.onBodyClick(post.postNumber, (e.currentTarget as HTMLElement).getBoundingClientRect().top)
  }

  function handleAnchorClick(numbers: number[], e: React.MouseEvent) {
    e.stopPropagation()
    if (window.getSelection()?.toString().trim()) return
    handlers.onAnchorClick(numbers, (e.currentTarget as HTMLElement).getBoundingClientRect().top)
  }

  const parts = tokenizeContent(displayContent)
  const bodyTextClass = !isDeleted && anchorCount >= 3 ? numHeat : isDeleted ? 'text-slate-500 italic' : 'text-slate-700 dark:text-slate-300'

  const renderedContent = parts.map((part, i) => {
    if (part.type === 'anchor') {
      return (
        <button
          key={i}
          type="button"
          className="text-c-anchor hover:text-c-anchor-hover hover:underline text-sm"
          onClick={(e) => handleAnchorClick(part.numbers, e)}
        >
          {part.raw}
        </button>
      )
    }
    if (part.type === 'url') {
      return (
        <a
          key={i}
          href={part.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`text-sm break-all hover:underline ${LINK_COLORS[part.linkType]}`}
          onClick={(e) => e.stopPropagation()}
        >
          {part.url}
        </a>
      )
    }
    if (part.type === 'emoji') {
      return (
        <span key={i} className="emoji">
          {part.text}
        </span>
      )
    }
    return (
      <span key={i} className={bodyTextClass}>
        {part.text}
      </span>
    )
  })

  const articleBg = isOwnPost
    ? 'var(--c-own-tint)'
    : isReplyToOwn
      ? 'var(--c-reply-tint)'
      : undefined

  return (
    <article
      className={`w-full ${showTopDivider ? 'border-t border-c-border pt-2' : ''} ${(isOwnPost || isReplyToOwn) ? 'px-2 py-1' : ''}`}
      style={articleBg ? { background: articleBg } : undefined}
      id={isInPopup ? undefined : `post-${post.postNumber}`}
    >
      {/* ヘッダー */}
      <div className={`flex items-center mb-1 flex-nowrap overflow-hidden ${compact ? 'gap-1' : 'gap-3'}`}>
        {/* レス番号バッジ */}
        <button
          type="button"
          className={`font-bold ${compact ? 'text-xs' : 'text-sm'} flex items-center gap-1 ${numHeat || 'text-blue-400'} ${anchorCount > 0 ? 'hover:opacity-80' : 'cursor-default'}`}
          onClick={anchorCount > 0 ? (e) => handlers.onBadgeClick(post.postNumber, getTriggerY(e)) : undefined}
        >
          <span>{post.postNumber}</span>
          {anchorCount > 0 && (
            <span className={`text-xs ${numHeat || 'text-slate-500'}`}>({anchorCount})</span>
          )}
        </button>

        {/* 投稿者名 */}
        <button
          type="button"
          className={`font-bold text-c-poster-name ${compact ? 'text-[10px]' : 'text-xs'} hover:text-c-poster-name-hover`}
          onClick={(e) => handlers.onNameClick(post.posterName, getTriggerY(e))}
        >
          {displayName}
        </button>

        {post.posterOptionInfo && (
          <span className={`${compact ? 'text-[10px]' : 'text-xs'} text-slate-500`}>{post.posterOptionInfo}</span>
        )}
        <span className={`${compact ? 'text-[10px]' : 'text-xs'} text-slate-500`}>{fullDateTime(post.createdAt, compact)}</span>

        {/* ID */}
        {displayAuthorId && (
          <button
            type="button"
            className={`${compact ? 'text-[10px]' : 'text-xs'} font-mono flex items-center gap-0.5 hover:opacity-80 ${idColorClass(idCount)}`}
            onClick={(e) => handlers.onIdClick(post.authorId, getTriggerY(e))}
          >
            <span>ID:{displayAuthorId}</span>
            {idCount >= 2 && <span className="text-xs">({idCount})</span>}
          </button>
        )}

        {/* 返信ボタン */}
        <button
          type="button"
          className={`${compact ? 'text-[10px]' : 'text-xs'} text-slate-500 dark:text-slate-600 bg-slate-100 dark:bg-slate-800/50 px-1.5 py-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-300 transition-colors ml-auto`}
          onClick={() => handlers.onReply(post.postNumber)}
        >
          返信
        </button>
      </div>

      {/* 本文 */}
      <div
        className={`ml-1 ${
          isOwnPost ? 'pl-[13px] border-l-[3px] border-c-accent'
          : isReplyToOwn ? 'pl-[13px] border-l-[3px] border-[var(--c-reply-line)]'
          : 'pl-4 border-l-2 border-c-border'
        } ${hasConnections ? 'cursor-pointer' : ''}`}
        onClick={handleBodyClick}
      >
        <p
          ref={isAAContent ? aaRef : null}
          className={`text-sm ${isAAContent ? 'aa-font whitespace-pre' : 'whitespace-pre-wrap break-words leading-relaxed'}`}
        >{renderedContent}</p>

        {/* サムネイル */}
        {(imageUrls.length > 0 || youtubeItems.length > 0) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {imageUrls.map((url, i) => (
              <button
                key={i}
                type="button"
                className="w-20 h-20 bg-slate-900 border border-slate-700 rounded overflow-hidden flex-shrink-0 flex items-center justify-center hover:border-slate-500 transition-colors"
                onClick={(e) => {
                  e.stopPropagation()
                  setLightboxImages(imageUrls)
                  setLightboxIndex(i)
                }}
              >
                <img
                  src={url}
                  alt="thumbnail"
                  className="w-full h-full object-contain"
                  loading="lazy"
                  onError={(e) => {
                    const img = e.target as HTMLImageElement
                    img.style.display = 'none'
                    const parent = img.parentElement
                    if (parent && !parent.querySelector('span')) {
                      const span = document.createElement('span')
                      span.className = 'text-slate-600 text-[10px] p-1 text-center leading-tight'
                      span.textContent = '画像を取得できません'
                      parent.appendChild(span)
                    }
                  }}
                />
              </button>
            ))}
            {youtubeItems.map((item, i) => {
              const videoId = item.videoId ?? getYouTubeVideoId(item.url)
              if (!videoId) return null
              return (
                <a
                  key={`yt-${i}`}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative w-20 h-20 bg-slate-900 border border-slate-700 rounded overflow-hidden flex-shrink-0 flex items-center justify-center hover:border-slate-500 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <img
                    src={`https://img.youtube.com/vi/${videoId}/default.jpg`}
                    alt="YouTube thumbnail"
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement
                      img.style.display = 'none'
                      const parent = img.parentElement
                      if (parent && !parent.querySelector('span')) {
                        const span = document.createElement('span')
                        span.className = 'text-slate-600 text-[10px] p-1 text-center leading-tight'
                        span.textContent = '画像を取得できません'
                        parent.appendChild(span)
                      }
                    }}
                  />
                  <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-0.5 rounded leading-none pointer-events-none">
                    ▶
                  </span>
                </a>
              )
            })}
          </div>
        )}
      </div>

      {/* ライトボックス */}
      {lightboxIndex !== null && lightboxImages.length > 0 && (
        <div
          className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center"
          onClick={() => setLightboxIndex(null)}
          onTouchStart={(e) => {
            e.stopPropagation()
            lbTouchStartXRef.current = e.touches[0].clientX
          }}
          onTouchEnd={(e) => {
            e.stopPropagation()
            e.preventDefault()
            if (lbTouchStartXRef.current === null) return
            const dx = e.changedTouches[0].clientX - lbTouchStartXRef.current
            lbTouchStartXRef.current = null
            if (Math.abs(dx) < 20) {
              setLightboxIndex(null)
              return
            }
            if (dx > 0) lbPrev()
            else lbNext()
          }}
          onWheel={(e) => {
            if (lightboxImages.length <= 1) return
            e.deltaY > 0 ? lbNext() : lbPrev()
          }}
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-white hover:text-slate-300 z-10"
            onClick={() => setLightboxIndex(null)}
          >
            <span className="material-symbols-outlined text-3xl">close</span>
          </button>

          {/* 画像コンテナ（左右ボタンなし・スワイプ/スクロールのみ） */}
          <div
            className="relative inline-flex items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightboxImages[lightboxIndex]}
              alt="expanded"
              className="max-w-[100vw] max-h-[100vh] object-contain block"
            />
          </div>
        </div>
      )}
    </article>
  )
}
