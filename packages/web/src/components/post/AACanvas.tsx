import { useEffect, useRef } from 'react'
import { shareOrDownloadBlob } from '../../utils/downloadImage'

interface AACanvasProps {
  content: string
  compact?: boolean
  /** ダウンロードボタンを表示する場合のファイル名 (省略時はダウンロードボタン非表示) */
  downloadFilename?: string
}

/**
 * AA(アスキーアート)をCanvasに自前描画して拡大表示するためのコンポーネント。
 *
 * 2chのAA文化は、実は「全角:半角=2:1の等幅フォント」を前提にしたものではない。
 * 由来の'MS Pゴシック'は名前の通りプロポーショナル(P)フォントで、':'のような
 * 記号は元々狭く描かれる。当時はほぼ全員が同じMS Pゴシックを使っていたため、
 * 「全員が同じ(非等幅の)文字送り幅で見ている」ことでAAの見た目が揃っていた。
 * つまり必要なのは等幅グリッドの強制ではなく、全員が同じフォントの
 * 「ありのままの」文字送り幅で見ることである。
 *
 * 'aahub_light' はMS Pゴシックとほぼ同じ文字送り幅になるよう作られた自己ホスト
 * フォント (index.css の @font-face、public/fonts/ 参照)。これ1つに統一し、
 * 各文字を実際にそのフォントで描画した際の実測送り幅をそのまま積み上げる
 * (全角=半角の2倍、のような比率の強制は一切しない)。Webフォントとして
 * 全端末に同じフォントを配るため、端末やブラウザによらず同じ見た目になる。
 */
export default function AACanvas({ content, compact = false, downloadFilename }: AACanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false

    async function draw() {
      const fontSizePx = compact ? 12 : 13
      const fontSpec = `${fontSizePx}px "aahub_light", sans-serif`

      try {
        await document.fonts.load(fontSpec)
        await document.fonts.ready
      } catch {
        // フォント読み込みに失敗しても、フォールバックフォントのまま描画を続行する
      }
      if (cancelled || !canvas) return

      const lines = content.replace(/\r\n/g, '\n').split('\n')

      const measureCtx = document.createElement('canvas').getContext('2d')
      if (!measureCtx) return
      measureCtx.font = fontSpec
      const lineHeight = Math.ceil(fontSizePx * 1.3)

      // 各文字の実測幅を先に確定し、行ごとの合計幅・全体の最大幅を求める
      const lineChars: { ch: string; width: number }[][] = lines.map((line) =>
        Array.from(line).map((ch) => ({ ch, width: measureCtx.measureText(ch).width })),
      )
      let maxLineWidth = 0
      for (const chars of lineChars) {
        const width = chars.reduce((sum, c) => sum + c.width, 0)
        if (width > maxLineWidth) maxLineWidth = width
      }

      const dpr = window.devicePixelRatio || 1
      const cssWidth = Math.max(1, Math.ceil(maxLineWidth))
      const cssHeight = Math.max(1, lines.length * lineHeight)
      canvas.width = Math.ceil(cssWidth * dpr)
      canvas.height = Math.ceil(cssHeight * dpr)
      canvas.style.width = `${cssWidth}px`
      canvas.style.height = `${cssHeight}px`

      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, cssWidth, cssHeight)
      // 背景を塗っておく（透明のままだとダウンロードしたPNGを別の背景色の場所で
      // 開いたとき、白文字などが見えなくなってしまうため）
      const baseColor = getComputedStyle(document.documentElement).getPropertyValue('--c-base').trim()
      ctx.fillStyle = baseColor || (document.documentElement.classList.contains('dark') ? '#0f1115' : '#f1f5f9')
      ctx.fillRect(0, 0, cssWidth, cssHeight)
      ctx.font = fontSpec
      ctx.textBaseline = 'top'
      ctx.fillStyle = document.documentElement.classList.contains('dark') ? '#ffffff' : '#000000'

      lineChars.forEach((chars, lineIndex) => {
        let x = 0
        const y = lineIndex * lineHeight
        for (const { ch, width } of chars) {
          ctx.fillText(ch, x, y)
          x += width
        }
      })
    }

    void draw()
    return () => {
      cancelled = true
    }
  }, [content, compact])

  function handleDownload() {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob((blob) => {
      if (!blob) return
      void shareOrDownloadBlob(blob, downloadFilename ?? 'aa.png')
    }, 'image/png')
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="overflow-x-auto max-w-full">
        <canvas ref={canvasRef} />
      </div>
      {downloadFilename && (
        <button
          type="button"
          onClick={handleDownload}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          <span className="material-symbols-outlined text-sm leading-none">download</span>
          ダウンロード
        </button>
      )}
    </div>
  )
}
