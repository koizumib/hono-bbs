import { extractMedia, getYouTubeVideoId } from '../../utils/urlExtract'

interface ContentPreviewProps {
  content: string
  className?: string
  /** true: 1行横スクロール / false(default): 折り返し＋縦スクロール */
  nowrap?: boolean
}

export default function ContentPreview({ content, className = '', nowrap = false }: ContentPreviewProps) {
  const media = extractMedia(content)
  const imageUrls = media.filter((m) => m.type === 'image').map((m) => m.url)
  const youtubeItems = media.filter((m) => m.type === 'youtube')

  if (imageUrls.length === 0 && youtubeItems.length === 0) return null

  return (
    <div className={`flex gap-2 ${nowrap ? 'flex-nowrap overflow-x-auto' : 'flex-wrap overflow-y-auto'} ${className}`}>
      {imageUrls.map((url, i) => (
        <a
          key={i}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="w-16 h-16 bg-slate-900/50 border border-slate-700 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center hover:border-slate-500 transition-colors"
        >
          <img
            src={url}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              const img = e.target as HTMLImageElement
              img.style.display = 'none'
            }}
          />
        </a>
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
            className="relative w-16 h-16 bg-slate-900/50 border border-slate-700 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center hover:border-slate-500 transition-colors"
          >
            <img
              src={`https://img.youtube.com/vi/${videoId}/default.jpg`}
              alt="YouTube"
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-0.5 rounded pointer-events-none">
              ▶
            </span>
          </a>
        )
      })}
    </div>
  )
}
