import type { Thread } from '../../api/types'
import { relativeTime } from '../../utils/formatDate'
import { extractMedia, getYouTubeVideoId } from '../../utils/urlExtract'
import { getHistory } from '../../utils/threadHistory'

interface ThreadCardProps {
  thread: Thread
  isActive: boolean
  isSelected: boolean
  onClick: (e: React.MouseEvent) => void
  compact?: boolean
}

export default function ThreadCard({ thread, isActive, isSelected, onClick, compact = false }: ThreadCardProps) {
  // 勢い = レス数 / 経過時間(時間)
  const momentum = thread.postCount / Math.max(0.01, (Date.now() - new Date(thread.firstPost?.createdAt ?? thread.createdAt).getTime()) / 3_600_000)
  const isTrending = momentum > 50

  // Momentum level: 0=very low, 1=low, 2=medium, 3=high
  const momentumLevel: 0 | 1 | 2 | 3 =
    momentum > 50 ? 3 : momentum > 10 ? 2 : momentum > 1 ? 1 : 0

  const history = getHistory()
  const readEntry = history.find(e => e.threadId === thread.id)
  const unreadCount = readEntry && readEntry.lastReadCount < thread.postCount ? thread.postCount - readEntry.lastReadCount : 0

  const media = thread.firstPost ? extractMedia(thread.firstPost.content) : []
  const imageItem = media.find((m) => m.type === 'image')
  const youtubeItem = media.find((m) => m.type === 'youtube')
  const thumbnailUrl = imageItem?.url ?? null
  const videoId = youtubeItem
    ? (youtubeItem.videoId ?? getYouTubeVideoId(youtubeItem.url))
    : null
  const hasThumbnail = thumbnailUrl !== null || videoId !== null

  const creatorId = thread.firstPost?.authorId ?? null

  const momentumClass =
    momentumLevel === 3
      ? 'text-c-accent opacity-100'
      : momentumLevel === 2
      ? 'text-c-accent opacity-70'
      : momentumLevel === 1
      ? 'text-c-accent opacity-40'
      : 'text-slate-400'

  return (
    <div
      onClick={onClick}
      className={`${compact ? 'p-2' : 'p-4'} border-b border-c-border cursor-pointer transition-colors relative ${
        isSelected
          ? 'bg-c-accent/15'
          : isActive
          ? 'bg-slate-100 dark:bg-slate-800/30'
          : 'hover:bg-slate-50 dark:hover:bg-slate-800/20'
      }`}
    >
      {isSelected
        ? <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: 'var(--c-accent)', opacity: 0.7 }} />
        : isActive
        ? <div className="absolute left-0 top-0 bottom-0 w-1 bg-c-accent" />
        : readEntry
        ? <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-400/40" />
        : null
      }

      <div className="flex justify-between items-start mb-1">
        {isTrending ? (
          <span className="text-[10px] font-bold text-c-accent uppercase tracking-tighter">
            🔥 トレンド
          </span>
        ) : (
          <span className="text-[10px] text-slate-500" />
        )}
        <span className="text-[10px] text-slate-500">{relativeTime(thread.updatedAt)}</span>
      </div>

      <div className="flex gap-3">
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
        <div className="flex-1 min-w-0">
          <h3
            className={`text-sm leading-tight mb-1 line-clamp-2 ${
              isActive ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-200'
            }`}
          >
            {thread.title}
          </h3>
          <div className="flex items-center text-[10px] gap-3">
            <div className="flex items-center gap-1 text-slate-400">
              <span className="font-bold">レス:</span>
              <span>{thread.postCount}</span>
            </div>
            <div className={`flex items-center gap-1 ${momentumClass}`}>
              <span className="font-bold">勢い:</span>
              <span>
                {momentum > 1000 ? `${(momentum / 1000).toFixed(1)}k` : Math.round(momentum)}
              </span>
            </div>
            <div className="ml-auto flex flex-col items-end gap-0.5">
              {unreadCount > 0 && (
                <span
                  className="font-bold text-[9px] px-1.5 py-0.5 rounded"
                  style={{ background: 'var(--c-accent)', color: 'var(--c-accent-text)' }}
                >
                  +{unreadCount}
                </span>
              )}
              {creatorId && <span className="text-slate-400 font-mono truncate">ID:{creatorId}</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
