import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { relativeTime } from '../../utils/formatDate'
import { extractMedia, getYouTubeVideoId } from '../../utils/urlExtract'
import BoardAvatar from '../board/BoardAvatar'
import ImageLightbox from '../ui/ImageLightbox'

const MAX_IMAGE_TILES = 4

// x.com風の画像レイアウト: 1枚=横長1枠いっぱい、2枚=左右2分割、
// 3枚=左に縦長1枚+右に上下2枚、4枚=田の字。常に同じ全体比率(aspect-video)の枠を
// グリッドで分割する(枚数が変わっても枠全体の大きさが変わらないようにする)。
function imageGridClassName(count: number): string {
  if (count <= 1) return 'grid-cols-1'
  if (count === 2) return 'grid-cols-2'
  return 'grid-cols-2 grid-rows-2'
}

function imageTileClassName(index: number, count: number): string {
  if (count === 3 && index === 0) return 'row-span-2'
  return ''
}

export interface HomeThreadCardData {
  boardId: string
  boardName: string
  boardIcon?: string | null
  boardColorTheme?: string | null
  threadId: string
  title: string
  postCount: number
  momentum: number
  createdAt: string
  opAuthorId: string | null
  opPosterName?: string
  opPosterOptionInfo?: string
  /** 1レス目の本文(未加工)。画像URLの抽出・改行付きプレビューはここから行う */
  opContent: string
}

interface HomeThreadCardProps {
  data: HomeThreadCardData
  /** このタブ内での勢いの相対順位(0=最下位〜1=最上位)。utils/momentum.tsのrankMomentum参照 */
  momentumRank: number
  /** 「未読スレッド」タブ専用: 前回既読からの新着レス数 */
  unreadCount?: number
  /** 未指定時は自分でnavigateする。板のスレッド一覧など、クリック時の挙動(複数選択・
   *  再クリックでの再取得等)を呼び出し側で制御したい場合に上書きする */
  onClick?: (e: React.MouseEvent) => void
  /** 板のスレッド一覧でのみ使う: 現在表示中のスレッドの強調表示 */
  isActive?: boolean
  /** 一覧更新で新しく現れたスレッドの目印(ドット) */
  isNew?: boolean
  /** 新しく現れた直後だけ一瞬光らせる */
  flash?: boolean
}

export default function HomeThreadCard({ data, momentumRank, unreadCount, onClick, isActive = false, isNew = false, flash = false }: HomeThreadCardProps) {
  const navigate = useNavigate()
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const momentumLevel: 0 | 1 | 2 | 3 =
    momentumRank >= 0.9 ? 3 : momentumRank >= 0.6 ? 2 : momentumRank >= 0.3 ? 1 : 0
  const momentumColorClass =
    momentumLevel === 3 ? 'text-c-heat-very-hot'
    : momentumLevel === 2 ? 'text-c-heat-hot'
    : momentumLevel === 1 ? 'text-c-heat-warm'
    : 'text-c-text-muted'
  const momentumFilled = momentumLevel >= 2

  const media = data.opContent ? extractMedia(data.opContent) : []
  const imageItems = media.filter((m) => m.type === 'image')
  const imageUrls = imageItems.map((m) => m.url)
  const videoItem = imageItems.length === 0 ? media.find((m) => m.type === 'youtube') : undefined
  const videoId = videoItem ? (videoItem.videoId ?? getYouTubeVideoId(videoItem.url)) : null
  const shownImages = imageItems.slice(0, MAX_IMAGE_TILES)
  const extraImageCount = Math.max(0, imageItems.length - MAX_IMAGE_TILES)

  function handleClick(e: React.MouseEvent) {
    if (onClick) { onClick(e); return }
    navigate(`/${data.boardId}/${data.threadId}`)
  }

  return (
    <article
      onClick={handleClick}
      className={`p-4 rounded-[var(--card-radius)] border transition-colors flex flex-col gap-2 cursor-pointer group ${flash ? 'flash-new' : ''} ${
        isActive
          ? 'bg-[var(--card-selected-bg)] border-[var(--card-selected-border-color)]'
          : 'bg-c-surface border-transparent hover:bg-c-surface2'
      }`}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          {isNew && (
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: 'var(--c-accent-self)' }}
            />
          )}
          <BoardAvatar name={data.boardName} icon={data.boardIcon} colorTheme={data.boardColorTheme} size={18} />
          <span className="font-mono text-[10.5px] text-c-text-muted truncate">{data.boardName}</span>
          <span className="text-[10.5px] text-c-text-muted">{relativeTime(data.createdAt)}</span>
          {data.opAuthorId && (
            <>
              <span className="text-c-text-muted">・</span>
              <span className="font-mono text-[10.5px] text-c-text-muted">OP:{data.opAuthorId}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {unreadCount !== undefined && (
            <span
              className="font-mono text-[10.5px] font-bold px-1.5 py-0.5 rounded"
              style={{ background: 'var(--c-accent-self-wash)', color: 'var(--c-accent-self)' }}
            >
              +{unreadCount}
            </span>
          )}
          <div className={`flex items-center gap-1 bg-c-base px-1.5 py-0.5 rounded ${momentumColorClass}`}>
            <span className={`material-symbols-outlined text-sm leading-none ${momentumFilled ? 'fill' : ''}`}>local_fire_department</span>
            <span className="font-mono text-[10.5px] font-bold">{Math.round(data.momentum)}/h</span>
          </div>
          <div className="flex items-center gap-1 text-c-text-muted">
            <span className="material-symbols-outlined text-base leading-none">chat_bubble_outline</span>
            <span className="font-mono text-[10.5px]">{data.postCount}</span>
          </div>
        </div>
      </div>

      <h3 className="text-sm font-semibold text-c-text-strong group-hover:text-c-accent transition-colors leading-snug line-clamp-2">
        {data.title}
      </h3>

      {data.opContent.trim() && (
        <p className="text-xs text-c-text-body whitespace-pre-wrap [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:16] overflow-hidden">{data.opContent.trim()}</p>
      )}

      {shownImages.length > 0 && (
        <div className={`grid gap-0.5 rounded-[var(--card-radius)] overflow-hidden w-full aspect-video pt-1 ${imageGridClassName(shownImages.length)}`}>
          {shownImages.map((item, i) => {
            const isLastTile = i === MAX_IMAGE_TILES - 1 && extraImageCount > 0
            return (
              <div
                key={item.url + i}
                className={`relative overflow-hidden bg-c-base ${imageTileClassName(i, shownImages.length)}`}
                onClick={(e) => { e.stopPropagation(); setLightboxIndex(i) }}
              >
                <img
                  src={item.url}
                  alt=""
                  className={`w-full h-full object-cover ${isLastTile ? 'brightness-50' : ''}`}
                  loading="lazy"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
                {isLastTile && (
                  <div className="absolute inset-0 flex items-center justify-center text-c-text-strong font-bold text-lg bg-c-base/40 backdrop-blur-[1px]">
                    +{extraImageCount}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {videoId && (
        <div className="relative w-full aspect-video rounded-[var(--btn-radius)] overflow-hidden border border-c-border bg-c-base">
          <img
            src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
            alt=""
            className="w-full h-full object-cover brightness-75"
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-11 h-11 rounded-full bg-c-accent/90 flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl text-[var(--c-accent-text)] pl-0.5">play_arrow</span>
            </div>
          </div>
        </div>
      )}

      {imageUrls.length > 0 && (
        <ImageLightbox
          images={imageUrls}
          index={lightboxIndex ?? 0}
          isOpen={lightboxIndex !== null}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
          threadTitle={data.title}
          opContent={data.opContent}
          opAuthorId={data.opAuthorId}
          opPosterName={data.opPosterName}
          opPosterOptionInfo={data.opPosterOptionInfo}
          createdAt={data.createdAt}
          boardId={data.boardId}
          threadId={data.threadId}
        />
      )}
    </article>
  )
}
