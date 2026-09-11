import { useEffect, useRef, useState } from 'react'
import type { Post } from '../../api/types'
import { extractMedia } from '../../utils/urlExtract'

interface MinimapProps {
  posts: Post[]
  scrollAreaRef: React.RefObject<HTMLDivElement | null>
  anchorCountMap: Map<number, number>
  ownPostNumbers?: Set<number>
  replyToOwnNumbers?: Set<number>
}

// PostArticle.tsx の heatClass と同じ暖色ランプ(--c-heat-*)を参照する
function heatColor(count: number): string {
  if (count >= 7) return 'var(--c-heat-very-hot)'
  if (count >= 5) return 'var(--c-heat-hot)'
  return 'var(--c-heat-warm)'
}

export default function Minimap({ posts, scrollAreaRef, anchorCountMap, ownPostNumbers, replyToOwnNumbers }: MinimapProps) {
  const thumbRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // 各レスの実際の DOM 位置を保持（postNumber → scrollHeight に対する割合 %）
  // つまみは scrollTop/scrollHeight で計算するため、同じ座標系で揃える
  const [actualPcts, setActualPcts] = useState<Map<number, number>>(new Map())

  useEffect(() => {
    const scrollArea = scrollAreaRef.current
    if (!scrollArea) return

    function computeActualPcts() {
      const sa = scrollAreaRef.current
      if (!sa || sa.scrollHeight === 0) return
      const saRect = sa.getBoundingClientRect()
      const { scrollHeight, scrollTop } = sa
      const newPcts = new Map<number, number>()
      for (const post of posts) {
        const el = document.getElementById(`post-${post.postNumber}`)
        if (!el) continue
        const elRect = el.getBoundingClientRect()
        // スクロール量を加算してコンテンツ先頭からの絶対位置を求める
        const relTop = elRect.top - saRect.top + scrollTop
        newPcts.set(post.postNumber, (relTop / scrollHeight) * 100)
      }
      setActualPcts(newPcts)
    }

    // 初回: DOM が安定してから計算（double rAF で確実に描画後に実行）
    let rafId = requestAnimationFrame(() => {
      rafId = requestAnimationFrame(computeActualPcts)
    })

    // コンテンツ高さ変化（レス追加など）で再計算
    const observer = new ResizeObserver(computeActualPcts)
    observer.observe(scrollArea)
    window.addEventListener('resize', computeActualPcts)

    return () => {
      cancelAnimationFrame(rafId)
      observer.disconnect()
      window.removeEventListener('resize', computeActualPcts)
    }
  }, [posts, scrollAreaRef])

  // マーカー位置: 実際のDOM位置があればそれを使い、なければインデックスの近似値
  const total = Math.max(1, posts.length - 1)
  function getPct(postNumber: number, fallbackIndex: number): number {
    const actual = actualPcts.get(postNumber)
    if (actual !== undefined) return actual
    return (fallbackIndex / total) * 100
  }

  // マウスドラッグ（デスクトップ）
  function handleThumbMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    const scrollArea = scrollAreaRef.current
    if (!scrollArea) return
    const startY = e.clientY
    const startScrollTop = scrollArea.scrollTop
    const { scrollHeight, clientHeight } = scrollArea

    function onMouseMove(ev: MouseEvent) {
      const delta = ev.clientY - startY
      const ratio = scrollHeight / clientHeight
      scrollArea!.scrollTop = startScrollTop + delta * ratio
    }
    function onMouseUp() {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      document.body.style.userSelect = ''
    }
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  // タッチ操作: ミニマップ全体を当たり判定にする
  // つまみ付近なら「ドラッグでスクロール」、それ以外なら「その位置にジャンプ」
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const HIT_TOLERANCE = 20

    function onContainerTouchStart(e: TouchEvent) {
      e.stopPropagation()
      e.preventDefault()
      const scrollArea = scrollAreaRef.current
      const thumb = thumbRef.current
      if (!scrollArea || !thumb) return

      const touchY = e.touches[0].clientY
      const thumbRect = thumb.getBoundingClientRect()
      const { scrollHeight, clientHeight } = scrollArea
      const isNearThumb =
        touchY >= thumbRect.top - HIT_TOLERANCE &&
        touchY <= thumbRect.bottom + HIT_TOLERANCE

      if (isNearThumb) {
        const startY = touchY
        const startScrollTop = scrollArea.scrollTop

        function onTouchMove(ev: TouchEvent) {
          ev.preventDefault()
          const delta = ev.touches[0].clientY - startY
          const ratio = scrollHeight / clientHeight
          scrollArea!.scrollTop = startScrollTop + delta * ratio
        }
        function onTouchEnd() {
          window.removeEventListener('touchmove', onTouchMove)
          window.removeEventListener('touchend', onTouchEnd)
        }
        window.addEventListener('touchmove', onTouchMove, { passive: false })
        window.addEventListener('touchend', onTouchEnd)
      } else {
        const containerRect = container!.getBoundingClientRect()
        const relY = (touchY - containerRect.top) / containerRect.height
        scrollArea.scrollTop = relY * scrollHeight
      }
    }

    container.addEventListener('touchstart', onContainerTouchStart, { passive: false })
    return () => container.removeEventListener('touchstart', onContainerTouchStart)
  }, [scrollAreaRef])

  // つまみ位置をスクロールに追従させる
  useEffect(() => {
    const scrollArea = scrollAreaRef.current
    const thumb = thumbRef.current
    if (!scrollArea || !thumb) return

    function update() {
      if (!scrollArea || !thumb) return
      const { scrollHeight, clientHeight, scrollTop } = scrollArea
      thumb.style.height = `${(clientHeight / scrollHeight) * 100}%`
      thumb.style.top = `${(scrollTop / scrollHeight) * 100}%`
    }

    scrollArea.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    update()
    return () => {
      scrollArea.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [scrollAreaRef])

  function scrollToPost(postNumber: number) {
    const el = document.getElementById(`post-${postNumber}`)
    el?.scrollIntoView({ behavior: 'instant', block: 'start' })
  }

  const mediaMarkers = posts
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => extractMedia(p.content).some((m) => m.type === 'image' || m.type === 'youtube'))
    .map(({ p, i }) => ({
      postNumber: p.postNumber,
      percent: getPct(p.postNumber, i),
      type: extractMedia(p.content).some((m) => m.type === 'image') ? 'image' : 'youtube',
    }))

  const ownPostMarkers = ownPostNumbers && ownPostNumbers.size > 0
    ? posts
        .map((p, i) => ({ p, i }))
        .filter(({ p }) => ownPostNumbers.has(p.postNumber))
        .map(({ p, i }) => ({ postNumber: p.postNumber, percent: getPct(p.postNumber, i) }))
    : []

  const replyToOwnMarkers = replyToOwnNumbers && replyToOwnNumbers.size > 0
    ? posts
        .map((p, i) => ({ p, i }))
        .filter(({ p }) => replyToOwnNumbers.has(p.postNumber))
        .map(({ p, i }) => ({ postNumber: p.postNumber, percent: getPct(p.postNumber, i) }))
    : []

  const heatMarkers = posts
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => (anchorCountMap.get(p.postNumber) ?? 0) >= 3)
    .map(({ p, i }) => ({
      postNumber: p.postNumber,
      percent: getPct(p.postNumber, i),
      count: anchorCountMap.get(p.postNumber) ?? 0,
    }))

  return (
    <div
      ref={containerRef}
      className="w-[21px] flex-shrink-0 relative pt-4 pb-40"
      style={{
        background: 'var(--c-surface2)',
        border: '1px solid var(--c-border)',
        borderRadius: 'var(--minimap-radius)',
        touchAction: 'none',
      }}
    >
      {/* 自分の投稿への返信（アウトラインダイヤ、色は自分のレスと同じ） */}
      {replyToOwnMarkers.map((m) => (
        <button
          key={`reply-${m.postNumber}`}
          onClick={() => scrollToPost(m.postNumber)}
          className="absolute left-1/2 w-2.5 h-2.5 hover:opacity-80 transition-opacity z-[11] rounded-[1px]"
          style={{
            top: `${m.percent}%`,
            transform: 'translateX(-50%) translateY(-50%) rotate(45deg)',
            background: 'transparent',
            border: '1.5px solid var(--c-accent)',
          }}
          title={`自分への返信: ${m.postNumber}`}
        />
      ))}

      {/* 自分のレスのダイヤ形マーカー */}
      {ownPostMarkers.map((m) => (
        <button
          key={`own-${m.postNumber}`}
          onClick={() => scrollToPost(m.postNumber)}
          className="absolute left-1/2 w-2.5 h-2.5 hover:opacity-80 transition-opacity z-[12] rounded-[1px]"
          style={{
            top: `${m.percent}%`,
            transform: 'translateX(-50%) translateY(-50%) rotate(45deg)',
            background: 'var(--c-accent)',
          }}
          title={`自分のレス: ${m.postNumber}`}
        />
      ))}

      {/* 人気レスの横棒 */}
      {heatMarkers.map((m) => (
        <button
          key={`heat-${m.postNumber}`}
          onClick={() => scrollToPost(m.postNumber)}
          className="absolute left-0 right-0 h-1.5 hover:h-2 transition-all z-[10]"
          style={{
            top: `${m.percent}%`,
            background: heatColor(m.count),
          }}
          title={`${m.postNumber}: ${m.count}件のアンカー`}
        />
      ))}

      {/* メディアマーカー: 形(画像=四角、動画=三角)で種別を区別する。
          画像マーカーの色は本文中の画像URLリンクと同じ--c-link-imageにして
          「画像がある」という意味を色でも一致させる */}
      {mediaMarkers.map((m) =>
        m.type === 'image' ? (
          <button
            key={`media-${m.postNumber}`}
            onClick={() => scrollToPost(m.postNumber)}
            className="absolute left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-[1px] hover:scale-150 transition-transform z-[10]"
            style={{ top: `${m.percent}%`, background: 'var(--c-link-image)' }}
            title={`${m.postNumber}: 画像あり`}
          />
        ) : (
          <button
            key={`media-${m.postNumber}`}
            onClick={() => scrollToPost(m.postNumber)}
            className="absolute left-1/2 -translate-x-1/2 hover:scale-150 transition-transform z-[10]"
            style={{
              top: `${m.percent}%`,
              width: 0,
              height: 0,
              borderLeft: '3px solid transparent',
              borderRight: '3px solid transparent',
              borderBottom: '5px solid var(--c-text-muted)',
            }}
            title={`${m.postNumber}: YouTubeあり`}
          />
        ),
      )}

      {/* つまみ: 全マーカーより前面 */}
      <div
        ref={thumbRef}
        className="absolute left-0 right-0 rounded"
        style={{
          background: 'color-mix(in srgb, var(--c-text-muted) 25%, transparent)',
          border: '1px solid color-mix(in srgb, var(--c-text-muted) 45%, transparent)',
          cursor: 'ns-resize',
          zIndex: 20,
        }}
        onMouseDown={handleThumbMouseDown}
      />
    </div>
  )
}
