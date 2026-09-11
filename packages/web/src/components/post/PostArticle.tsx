import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import type { Post } from '../../api/types'
import { fullDateTime } from '../../utils/formatDate'
import { tokenizeContent, parseAnchorsFromContent } from '../../utils/anchorParse'
import { extractMedia, getYouTubeVideoId } from '../../utils/urlExtract'
import { heatClass } from '../../utils/heatColor'
import { env } from '../../config/env'
import { canDo } from '../../utils/permissions'
import { useAuthStore } from '../../stores/authStore'
import { downloadImageUrl } from '../../utils/downloadImage'
import { useBackGestureClose } from '../../hooks/useBackGestureClose'
import AACanvas from './AACanvas'

export interface PostHandlers {
  onAnchorClick: (numbers: number[], triggerY: number) => void
  onBadgeClick: (postNumber: number, triggerY: number) => void
  onIdClick: (id: string, triggerY: number) => void
  onNameClick: (name: string, triggerY: number) => void
  onBodyClick: (postNumber: number, triggerY: number) => void
  onReply: (postNumber: number) => void
  onReport: (postNumber: number) => void
  // モバイル版 (hooks/useThreadView.ts) では未実装。未提供の場合は削除ボタン自体を出さない。
  onDelete?: (postNumber: number) => void
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
  /** 更新で新しく取得できたレスの場合、描画時に一瞬光らせる */
  isNew?: boolean
}

const LINK_COLORS = {
  image:   'text-c-link-image hover:opacity-80',
  twitter: 'text-c-link-twitter hover:opacity-80',
  youtube: 'text-c-link-youtube hover:opacity-80',
  url:     'text-c-link hover:opacity-80',
} as const

// 長すぎるURLはレス本文内で邪魔になるので、表示だけ省略する（hrefは元のURLのまま）
function truncateUrlForDisplay(url: string, maxLength = 50): string {
  return url.length > maxLength ? `${url.slice(0, maxLength)}…` : url
}

function filenameFromUrl(url: string, fallback: string): string {
  try {
    const path = new URL(url, window.location.origin).pathname
    const name = path.split('/').pop()
    return name && name.includes('.') ? name : fallback
  } catch {
    return fallback
  }
}

// ID(投稿回数)・レスの被アンカー数、どちらも同じ暖色ランプ(heatClass)を共有する

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
  isNew = false,
}: PostArticleProps) {
  const userId = useAuthStore((s) => s.userId)
  const [lightboxImages, setLightboxImages] = useState<string[]>([])
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const lbTouchStartXRef = useRef<number | null>(null)
  const lightboxOverlayRef = useRef<HTMLDivElement>(null)
  const [aaLightboxOpen, setAaLightboxOpen] = useState(false)
  const aaLightboxOverlayRef = useRef<HTMLDivElement>(null)

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

  // スレッド表示画面のスワイプナビゲーション(戻る/書き込む)は、Panel Bの実DOMノードに
  // addEventListenerで直接張ったネイティブのtouchmoveリスナーで実装されている。
  // ネイティブのバブリングは、そのリスナーがReactの合成イベント(ルートに委譲され、
  // ネイティブのバブリングが完了してから発火する)より先に届いてしまうため、
  // ライトボックス側でReactのonTouchMoveにstopPropagationを書いても間に合わない。
  // ライトボックス自身のDOMノードにネイティブリスナーを張って、Panel Bへ届く前に
  // 止める必要がある。
  useEffect(() => {
    if (lightboxIndex === null) return
    const el = lightboxOverlayRef.current
    if (!el) return
    const stop = (e: TouchEvent) => e.stopPropagation()
    el.addEventListener('touchmove', stop, { passive: true })
    return () => el.removeEventListener('touchmove', stop)
  }, [lightboxIndex])

  useEffect(() => {
    if (!aaLightboxOpen) return
    const el = aaLightboxOverlayRef.current
    if (!el) return
    const stop = (e: TouchEvent) => e.stopPropagation()
    el.addEventListener('touchmove', stop, { passive: true })
    return () => el.removeEventListener('touchmove', stop)
  }, [aaLightboxOpen])

  // 画像/AAを直感的に「戻るジェスチャー」で閉じようとすると、モーダルだけでなく
  // スレッドそのものから抜けてしまう問題への対策（開いている間だけhistoryを1つ消費する）
  useBackGestureClose(lightboxIndex !== null, () => setLightboxIndex(null))
  useBackGestureClose(aaLightboxOpen, () => setAaLightboxOpen(false))

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
  const canDelete = !isDeleted && Boolean(handlers.onDelete) && canDo(post.acl, { userId, userRoleIds: [] }, 'delete')
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
  const bodyTextClass = !isDeleted && anchorCount >= 3 ? numHeat : isDeleted ? 'text-c-text-muted italic' : 'text-c-text-body'

  const renderedContent = parts.map((part, i) => {
    if (part.type === 'anchor') {
      return (
        <button
          key={i}
          type="button"
          className="text-c-link hover:opacity-80 hover:underline text-sm"
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
          title={part.url}
        >
          {truncateUrlForDisplay(part.url)}
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

  return (
    <article
      className={`w-full px-2 py-1 ${showTopDivider ? 'border-t border-c-border pt-2' : ''} ${isNew ? 'flash-new' : ''}`}
      id={isInPopup ? undefined : `post-${post.postNumber}`}
    >
      {/* ヘッダー */}
      <div className={`flex items-center mb-1 flex-nowrap overflow-hidden ${compact ? 'gap-1' : 'gap-3'}`}>
        {/* レス番号バッジ */}
        <button
          type="button"
          className={`font-bold ${compact ? 'text-xs' : 'text-sm'} flex items-center gap-1 ${numHeat || 'text-c-text-muted'} ${anchorCount > 0 ? 'hover:opacity-80' : 'cursor-default'}`}
          onClick={anchorCount > 0 ? (e) => handlers.onBadgeClick(post.postNumber, getTriggerY(e)) : undefined}
        >
          <span>{post.postNumber}</span>
          {anchorCount > 0 && (
            <span className={`text-xs ${numHeat || 'text-c-text-muted'}`}>({anchorCount})</span>
          )}
        </button>

        {/* 投稿者名 */}
        <button
          type="button"
          className={`font-bold text-c-poster-name ${compact ? 'text-[10px]' : 'text-xs'} hover:opacity-80`}
          onClick={(e) => handlers.onNameClick(post.posterName, getTriggerY(e))}
        >
          {displayName}
        </button>

        {post.posterOptionInfo && (
          <span className={`${compact ? 'text-[10px]' : 'text-xs'} text-c-text-muted`}>{post.posterOptionInfo}</span>
        )}
        <span className={`${compact ? 'text-[10px]' : 'text-xs'} text-c-text-muted`}>{fullDateTime(post.createdAt, compact)}</span>

        {/* ID */}
        {displayAuthorId && (
          <button
            type="button"
            className={`${compact ? 'text-[10px]' : 'text-xs'} font-mono flex items-center gap-0.5 hover:opacity-80 ${heatClass(idCount) || 'text-c-text-muted'}`}
            onClick={(e) => handlers.onIdClick(post.authorId, getTriggerY(e))}
          >
            <span>ID:{displayAuthorId}</span>
            {idCount >= 2 && <span className="text-xs">({idCount})</span>}
          </button>
        )}

        {/* 自分の投稿へのアンカーがある場合の「→あなた宛」バッジ */}
        {isReplyToOwn && (
          <span
            className={`${compact ? 'text-[9px]' : 'text-[10px]'} font-medium px-2 py-0.5`}
            style={{
              color: 'var(--c-accent)',
              background: 'var(--chip-bg)',
              border: '1px solid var(--chip-border-color)',
              borderRadius: 'var(--chip-radius)',
            }}
          >
            →あなた宛
          </span>
        )}

        {/* 返信ボタン（レス右上） */}
        <button
          type="button"
          className={`ml-auto flex-shrink-0 ${compact ? 'text-[10px]' : 'text-xs'} text-c-text-muted bg-c-surface2 px-1.5 py-0.5 rounded hover:bg-c-surface3 hover:text-c-text-body transition-colors`}
          onClick={() => handlers.onReply(post.postNumber)}
        >
          返信
        </button>
      </div>

      {/* 本文 */}
      <div
        className={`${
          isOwnPost ? 'bbs-post-own relative pl-[17px]' : 'pl-4 border-l-2 border-c-border'
        } ${hasConnections ? 'cursor-pointer' : ''}`}
        onClick={handleBodyClick}
      >
        <p
          ref={isAAContent ? aaRef : null}
          className={`text-sm text-c-text-strong ${isAAContent ? 'aa-font whitespace-pre' : 'whitespace-pre-wrap break-words leading-relaxed'}`}
        >{renderedContent}</p>

        {/* AAを崩れなく見るためのCanvas拡大表示ボタン（インライン/ポップアップ共通） */}
        {isAAContent && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setAaLightboxOpen(true) }}
            className="mt-1 flex items-center gap-1 text-[10px] text-c-text-muted hover:text-c-text-body transition-colors"
          >
            <span className="material-symbols-outlined text-sm leading-none">open_in_full</span>
            AAを画像で表示
          </button>
        )}

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

      {/* 通報・削除ボタン（レス右下） */}
      <div className="mt-1 flex items-center justify-end gap-1.5">
        {/* 通報ボタン (誰でも押せる。目立たせすぎないようにあえて背景無し) */}
        <button
          type="button"
          className={`${compact ? 'text-[10px]' : 'text-xs'} text-c-text-muted px-1 py-0.5 hover:text-c-text-body transition-colors`}
          onClick={() => handlers.onReport(post.postNumber)}
        >
          通報
        </button>

        {/* 削除ボタン (権限がある場合のみ。モバイル版など handlers.onDelete 未提供の画面では出さない) */}
        {canDelete && (
          <button
            type="button"
            className={`${compact ? 'text-[10px]' : 'text-xs'} text-c-text-muted bg-c-surface2 px-1.5 py-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/40 hover:text-red-600 dark:hover:text-red-400 transition-colors`}
            onClick={() => handlers.onDelete?.(post.postNumber)}
          >
            削除
          </button>
        )}
      </div>

      {/* ライトボックス */}
      {lightboxIndex !== null && lightboxImages.length > 0 && (
        <div
          ref={lightboxOverlayRef}
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
            className="absolute top-4 right-16 text-white hover:text-slate-300 z-10"
            onClick={(e) => {
              e.stopPropagation()
              void downloadImageUrl(
                lightboxImages[lightboxIndex],
                filenameFromUrl(lightboxImages[lightboxIndex], `image-${post.postNumber}.jpg`),
              )
            }}
            title="画像をダウンロード"
          >
            <span className="material-symbols-outlined text-3xl">download</span>
          </button>
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

      {/* AA拡大表示（Canvasに自前描画して端末依存のフォントズレを避ける） */}
      {aaLightboxOpen && (
        <div
          ref={aaLightboxOverlayRef}
          className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4"
          onClick={() => setAaLightboxOpen(false)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-white hover:text-slate-300 z-10"
            onClick={() => setAaLightboxOpen(false)}
          >
            <span className="material-symbols-outlined text-3xl">close</span>
          </button>

          <div
            className="max-w-full max-h-full overflow-auto bg-c-surface rounded-lg p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <AACanvas content={displayContent} downloadFilename={`aa-${post.postNumber}.png`} />
          </div>
        </div>
      )}
    </article>
  )
}
