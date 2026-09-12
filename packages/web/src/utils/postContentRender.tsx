import type { ReactNode } from 'react'
import { tokenizeContent } from './anchorParse'

export const LINK_COLORS = {
  // 画像URLの色はMinimapの画像マーカーと同じ--c-text-mutedに合わせる(マーカー側が基準)
  image:   'text-c-text-muted hover:opacity-80',
  twitter: 'text-c-link-twitter hover:opacity-80',
  youtube: 'text-c-link-youtube hover:opacity-80',
  url:     'text-c-link hover:opacity-80',
} as const

// 長すぎるURLはレス本文内で邪魔になるので、表示だけ省略する（hrefは元のURLのまま）
export function truncateUrlForDisplay(url: string, maxLength = 50): string {
  return url.length > maxLength ? `${url.slice(0, maxLength)}…` : url
}

interface RenderPostContentOptions {
  bodyTextClass?: string
  /** 未指定の場合、アンカー(>>N)はクリック不可の色付きテキストとして表示する
   *  (スレッド表示画面以外の場所ではジャンプ先のレスを持たないため) */
  onAnchorClick?: (numbers: number[], e: React.MouseEvent) => void
}

// PostArticle.tsx(スレッド表示画面)と画像ライトボックスの右パネル(元レスプレビュー)で
// 本文の色付け(URL種別ごとの色・アンカー)を共通化する
export function renderPostContentParts(content: string, options: RenderPostContentOptions = {}): ReactNode[] {
  const { bodyTextClass = 'text-c-text-strong', onAnchorClick } = options
  const parts = tokenizeContent(content)

  return parts.map((part, i) => {
    if (part.type === 'anchor') {
      if (onAnchorClick) {
        return (
          <button
            key={i}
            type="button"
            className="text-c-link hover:opacity-80 hover:underline text-sm"
            onClick={(e) => { e.stopPropagation(); onAnchorClick(part.numbers, e) }}
          >
            {part.raw}
          </button>
        )
      }
      return (
        <span key={i} className="text-c-link text-sm">
          {part.raw}
        </span>
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
}
