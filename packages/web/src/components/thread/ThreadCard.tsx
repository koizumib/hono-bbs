import type { Thread } from '../../api/types'
import { relativeTime } from '../../utils/formatDate'
import { extractMedia, getYouTubeVideoId } from '../../utils/urlExtract'
import { getHistory } from '../../utils/threadHistory'
import { calculateMomentum } from '../../utils/momentum'

interface ThreadCardProps {
  thread: Thread
  isActive: boolean
  isSelected: boolean
  onClick: (e: React.MouseEvent) => void
  compact?: boolean
  /** 更新で新しく取得できたスレッドの場合、描画時に一瞬光らせる */
  isNew?: boolean
}

export default function ThreadCard({ thread, isActive, isSelected, onClick, compact = false, isNew = false }: ThreadCardProps) {
  const momentum = calculateMomentum(thread)

  // 勢いレベル: 0=muted → 1=heat-warm → 2=heat-hot(fill) → 3=heat-very-hot(fill)
  const momentumLevel: 0 | 1 | 2 | 3 =
    momentum > 50 ? 3 : momentum > 10 ? 2 : momentum > 1 ? 1 : 0
  const momentumColorClass =
    momentumLevel === 3 ? 'text-c-heat-very-hot'
    : momentumLevel === 2 ? 'text-c-heat-hot'
    : momentumLevel === 1 ? 'text-c-heat-warm'
    : 'text-c-text-muted'
  const momentumFilled = momentumLevel >= 2

  const history = getHistory()
  const readEntry = history.find(e => e.threadId === thread.id)
  const unreadCount = readEntry && readEntry.lastReadCount < thread.postCount ? thread.postCount - readEntry.lastReadCount : 0
  // ドットは「一覧更新で完全に新しく立てられたスレッド」専用の目印(isNew)。
  // 未読(既読だが新しいレスがある/一度も開いていない)かどうかとは別の概念で、
  // タイトルの強調表示(白+太字)は引き続き未読状態を見る。
  const hasUnread = !readEntry || readEntry.lastReadCount < thread.postCount

  const media = thread.firstPost ? extractMedia(thread.firstPost.content) : []
  const imageItem = media.find((m) => m.type === 'image')
  const youtubeItem = media.find((m) => m.type === 'youtube')
  const thumbnailUrl = imageItem?.url ?? null
  const videoId = youtubeItem
    ? (youtubeItem.videoId ?? getYouTubeVideoId(youtubeItem.url))
    : null
  const hasThumbnail = thumbnailUrl !== null || videoId !== null

  const creatorId = thread.firstPost?.authorId ?? null

  const selected = isSelected || isActive

  return (
    <div
      onClick={onClick}
      className={`${compact ? 'px-3 py-2' : 'px-4 py-3'} cursor-pointer transition-colors relative border rounded-[var(--card-radius)] ${isNew ? 'flash-new' : ''} ${
        selected
          ? 'bg-[var(--card-selected-bg)] border-[var(--card-selected-border-color)]'
          : 'bg-[var(--card-bg)] border-[var(--card-border-color)] hover:bg-c-surface2'
      }`}
    >
      {/* タイトル行: 新着ドット + 画像 + スレタイ + 新着レス数バッジ */}
      <div className="flex items-center gap-2.5 min-w-0">
        {isNew && (
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: 'var(--c-accent-self)' }}
          />
        )}
        {hasThumbnail && (
          <div
            className={`${compact ? 'w-12 h-12' : 'w-16 h-16'} rounded flex-shrink-0 overflow-hidden flex items-center justify-center`}
            style={
              videoId
                ? { border: '2px solid #ff0000', background: '#000' }
                : { border: '1px solid var(--c-border)', background: 'var(--c-surface)' }
            }
          >
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt="thumbnail"
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            ) : videoId ? (
              <div className="relative w-full h-full">
                <img
                  src={`https://img.youtube.com/vi/${videoId}/default.jpg`}
                  alt="YouTube thumbnail"
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
                <span className="absolute bottom-0.5 right-0.5 bg-black/80 text-white text-[8px] px-0.5 rounded leading-none pointer-events-none">
                  ▶
                </span>
              </div>
            ) : null}
          </div>
        )}
        <h3
          className={`flex-1 min-w-0 text-sm leading-tight line-clamp-2 ${hasUnread ? 'font-bold' : 'font-medium text-c-text-body'}`}
          style={hasUnread ? { color: 'var(--c-text-emphasis)' } : undefined}
        >
          {thread.title}
        </h3>
        {unreadCount > 0 && (
          <span
            className="flex-shrink-0 font-bold text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap"
            style={{ background: 'var(--c-accent-self)', color: 'var(--c-accent-self-text)' }}
          >
            +{unreadCount}
          </span>
        )}
      </div>

      {/* メタ行: 時間 → 勢いアイコン＋レス数 → (右端)ID */}
      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-c-text-muted">
        <span className="select-none whitespace-nowrap">{relativeTime(thread.updatedAt)}</span>
        <div className={`flex items-center gap-1 ${momentumColorClass}`} title={`勢い：${Math.round(momentum)}`}>
          <span className={`material-symbols-outlined text-sm leading-none ${momentumFilled ? 'fill' : ''}`}>local_fire_department</span>
          <span>{thread.postCount}</span>
        </div>
        {creatorId && <span className="ml-auto font-mono truncate">ID:{creatorId}</span>}
      </div>
    </div>
  )
}
