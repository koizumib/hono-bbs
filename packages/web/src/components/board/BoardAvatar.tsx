import { useState } from 'react'

interface BoardAvatarProps {
  name: string
  icon?: string | null
  colorTheme?: string | null
  size?: number
  className?: string
}

const DEFAULT_COLOR = 'var(--c-accent)'

// サロゲートペア(絵文字等)を含む名前でも文字化けしないよう、コードポイント単位で先頭1文字を取る
function firstGrapheme(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  return Array.from(trimmed)[0]
}

/**
 * 板のアバター(丸アイコン)。板にiconが設定されていればその画像、無ければ
 * colorTheme(未設定時は既定のアクセントカラー)を背景に板名の頭文字を描画する。
 * 一覧行・メニューバーのお気に入り/閲覧履歴など、板を指し示す箇所で共通して使う。
 */
export default function BoardAvatar({ name, icon, colorTheme, size = 28, className = '' }: BoardAvatarProps) {
  const [imgFailed, setImgFailed] = useState(false)
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) }

  if (icon && !imgFailed) {
    return (
      <img
        src={icon}
        alt=""
        style={style}
        onError={() => setImgFailed(true)}
        className={`rounded-full object-cover flex-shrink-0 ${className}`}
      />
    )
  }

  return (
    <div
      style={{ ...style, background: colorTheme || DEFAULT_COLOR }}
      className={`rounded-full flex items-center justify-center flex-shrink-0 font-bold text-white leading-none ${className}`}
    >
      {firstGrapheme(name)}
    </div>
  )
}
