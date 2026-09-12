import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBackGestureClose } from '../../hooks/useBackGestureClose'
import { fullDateTime } from '../../utils/formatDate'
import { downloadImageUrl } from '../../utils/downloadImage'
import { renderPostContentParts } from '../../utils/postContentRender'

interface ImageLightboxProps {
  images: string[]
  index: number
  isOpen: boolean
  onClose: () => void
  onIndexChange: (index: number) => void
  /** PC版のみ: 画像右側のパネルに表示するレス情報。スレッド表示画面のレス
   * (PostArticle)と同じ配色・書式(レス番号・名前・ID・時刻・本文)で表示する */
  threadTitle?: string
  opContent?: string
  opAuthorId?: string | null
  opPosterName?: string
  opPosterOptionInfo?: string
  createdAt?: string
  /** パネルのレス番号バッジに表示する。ホーム画面はOP(常に1)、スレッド表示画面は
   * そのレス自身の番号を渡す */
  postNumber?: number
  /** 指定時のみダウンロードボタンを表示する(スレッド表示画面のレス画像用) */
  getDownloadFilename?: (url: string, index: number) => string
  /** 指定時、右パネルのスレタイ/本文をそれぞれスレッド先頭/該当レスへのリンクにする */
  boardId?: string
  threadId?: string
}

/**
 * 画像一覧をポップアップで表示するビューア。左右の矢印ボタン・キーボードの←→・
 * タッチスワイプで画像を切り替えられる(PCでのマウスホイール切り替えは意図的に無し)。
 *
 * isOpenがfalse⇔trueで開閉を表現し、呼び出し側は常にこのコンポーネントを
 * マウントし続けること(開くたびに条件付きレンダーで再マウントしない)。
 * useBackGestureCloseのeffectはReact StrictModeの開発時
 * mount→cleanup→remount挙動の影響で、「初回マウント時に既にisOpenがtrue」だと
 * cleanupのhistory.back()が発火させるpopstateが再マウント後のlistenerに
 * 非同期で届いてしまい、開いた直後に閉じてしまう競合が起きる。isOpenの変化を
 * 通常の依存配列の変化として扱えば(=初回マウント時はfalse)この競合を避けられる。
 */
export default function ImageLightbox({
  images, index, isOpen, onClose, onIndexChange,
  threadTitle, opContent, opAuthorId, opPosterName, opPosterOptionInfo, createdAt, postNumber,
  getDownloadFilename, boardId, threadId,
}: ImageLightboxProps) {
  const navigate = useNavigate()
  const touchStartXRef = useRef<number | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const hasPanel = Boolean(threadTitle)
  const threadHref = boardId && threadId ? `/${boardId}/${threadId}` : null

  function goToThread(e: React.MouseEvent, hash = '') {
    e.stopPropagation()
    if (!threadHref) return
    onClose()
    // useBackGestureCloseはisOpen=false化のクリーンアップでhistory.back()を呼び、
    // モーダルを開いた時に積んだ履歴エントリを消費する。それより先にここでnavigateすると、
    // 今積んだばかりの遷移先までback()が巻き戻してしまう(結果的に遷移が起きたように
    // 見えて実際には元のURLに戻ってしまう)ため、そのクリーンアップの後まで遅らせる。
    setTimeout(() => navigate(`${threadHref}${hash}`), 0)
  }

  function next() { onIndexChange((index + 1) % images.length) }
  function prev() { onIndexChange((index - 1 + images.length) % images.length) }

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, index, images.length])

  useBackGestureClose(isOpen, onClose)

  // スレッド表示画面(PostArticle)には独自のスワイプ操作(戻る/書き込みパネル)があり、
  // ネイティブのtouchmoveバブリングがReactの合成イベントより先に届いてしまうため、
  // Reactの onTouchMove で stopPropagation しても間に合わない。ライトボックス自身の
  // DOMノードに直接ネイティブリスナーを張って、それらに届く前に止める。
  useEffect(() => {
    if (!isOpen) return
    const el = overlayRef.current
    if (!el) return
    const stop = (e: TouchEvent) => e.stopPropagation()
    el.addEventListener('touchmove', stop, { passive: true })
    return () => el.removeEventListener('touchmove', stop)
  }, [isOpen])

  if (!isOpen || images.length === 0) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center"
      onClick={(e) => { e.stopPropagation(); onClose() }}
      onTouchStart={(e) => {
        e.stopPropagation()
        touchStartXRef.current = e.touches[0].clientX
      }}
      onTouchEnd={(e) => {
        e.stopPropagation()
        if (touchStartXRef.current === null) return
        const dx = e.changedTouches[0].clientX - touchStartXRef.current
        touchStartXRef.current = null
        if (Math.abs(dx) < 20) return
        if (dx > 0) prev()
        else next()
      }}
    >
      {getDownloadFilename && (
        <button
          type="button"
          className="absolute top-4 right-16 z-20 text-white hover:text-slate-300"
          onClick={(e) => {
            e.stopPropagation()
            void downloadImageUrl(images[index], getDownloadFilename(images[index], index))
          }}
          title="画像をダウンロード"
        >
          <span className="material-symbols-outlined text-3xl">download</span>
        </button>
      )}
      <button
        type="button"
        className={`absolute top-4 right-4 z-20 text-white hover:text-slate-300 ${hasPanel ? 'sm:hidden' : ''}`}
        onClick={(e) => { e.stopPropagation(); onClose() }}
      >
        <span className="material-symbols-outlined text-3xl">close</span>
      </button>

      <div className="relative flex items-stretch gap-4 h-full w-full sm:w-auto max-w-full">
        <div className={`relative w-full flex-shrink-0 h-full flex flex-col items-center ${hasPanel ? 'sm:w-[calc(70vw-16px)]' : 'sm:w-[90vw]'}`}>
          <div className="relative w-full flex-1 min-h-0">
            <img
              src={images[index]}
              alt=""
              className="w-full h-full object-contain block"
            />
          </div>

          {images.length > 1 && (
            <>
              <button
                type="button"
                className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 text-white hover:text-slate-300 z-10 bg-black/30 hover:bg-black/50 rounded-full w-11 h-11 flex items-center justify-center transition-colors"
                onClick={(e) => { e.stopPropagation(); prev() }}
              >
                <span className="material-symbols-outlined text-3xl">chevron_left</span>
              </button>
              <button
                type="button"
                className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 text-white hover:text-slate-300 z-10 bg-black/30 hover:bg-black/50 rounded-full w-11 h-11 flex items-center justify-center transition-colors"
                onClick={(e) => { e.stopPropagation(); next() }}
              >
                <span className="material-symbols-outlined text-3xl">chevron_right</span>
              </button>

              <div className="flex-shrink-0 flex flex-col items-center gap-2 py-3">
                <div className="flex items-center gap-2">
                  {images.map((url, i) => (
                    <button
                      key={url + i}
                      type="button"
                      aria-label={`${i + 1}枚目の画像を表示`}
                      onClick={(e) => { e.stopPropagation(); onIndexChange(i) }}
                      className={`w-2 h-2 rounded-full transition-colors ${i === index ? 'bg-white' : 'bg-white/40 hover:bg-white/60'}`}
                    />
                  ))}
                </div>
                <div className="text-white text-xs font-mono bg-black/50 px-2 py-1 rounded">
                  {index + 1} / {images.length}
                </div>
              </div>
            </>
          )}
        </div>

        {threadTitle && (
          <div
            className="hidden sm:flex flex-col self-center max-h-full w-[22vw] flex-shrink-0 bg-c-surface border border-c-border rounded-[var(--card-radius)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2 px-4 py-3 border-b border-c-border flex-shrink-0">
              {threadHref ? (
                <button
                  type="button"
                  onClick={(e) => goToThread(e)}
                  className="text-sm font-semibold text-c-text-strong leading-snug line-clamp-2 text-left hover:text-c-accent transition-colors min-w-0"
                >
                  {threadTitle}
                </button>
              ) : (
                <h3 className="text-sm font-semibold text-c-text-strong leading-snug line-clamp-2">{threadTitle}</h3>
              )}
              <button
                type="button"
                className="flex-shrink-0 text-c-text-muted hover:text-c-text-strong transition-colors"
                onClick={(e) => { e.stopPropagation(); onClose() }}
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
            {opContent?.trim() && (
              <div className="min-h-0 overflow-y-auto px-4 py-3">
                <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mb-1.5">
                  <span className="font-bold text-xs text-c-text-muted">{postNumber ?? 1}</span>
                  {opPosterName && (
                    <span className="font-bold text-c-poster-name text-xs">{opPosterName}</span>
                  )}
                  {opPosterOptionInfo && (
                    <span className="text-xs text-c-text-muted">{opPosterOptionInfo}</span>
                  )}
                  {createdAt && (
                    <span className="text-xs text-c-text-muted">{fullDateTime(createdAt)}</span>
                  )}
                  {opAuthorId && (
                    <span className="text-xs font-mono text-c-text-muted">ID:{opAuthorId}</span>
                  )}
                </div>
                <div
                  onClick={threadHref ? (e) => goToThread(e, `#post-${postNumber ?? 1}`) : undefined}
                  className={`pl-4 border-l-2 border-c-border ${threadHref ? 'cursor-pointer hover:bg-c-surface2 rounded-r transition-colors' : ''}`}
                >
                  <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                    {renderPostContentParts(opContent.trim())}
                  </p>
                  {images.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {images.map((url, i) => (
                        <button
                          key={url + i}
                          type="button"
                          aria-label={`${i + 1}枚目の画像に切り替え`}
                          onClick={(e) => { e.stopPropagation(); onIndexChange(i) }}
                          className={`w-16 h-16 rounded overflow-hidden border flex-shrink-0 transition-colors ${
                            i === index ? 'border-c-accent' : 'border-c-border hover:border-c-accent/50'
                          }`}
                        >
                          <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
