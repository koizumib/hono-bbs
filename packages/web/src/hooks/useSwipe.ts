import { useRef } from 'react'

interface SwipeOptions {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onSwipeUp?: () => void
  onSwipeDown?: () => void
  /** スワイプ開始を受け付けるX位置の範囲（画面幅の割合 0–1）。例: [0, 0.2] = 左端 20% のみ */
  edgeRatioX?: [number, number]
  /** 認識する最低移動距離 px（デフォルト: 60） */
  distanceThreshold?: number
  /** 認識する最低速度 px/ms（デフォルト: 0.3） */
  velocityThreshold?: number
}

/**
 * タッチスワイプ方向を検出するフック。
 * optRef パターンでコールバックの古い値問題を回避している。
 */
export function useSwipe(options: SwipeOptions) {
  const startRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const optRef = useRef(options)
  optRef.current = options

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    const { edgeRatioX } = optRef.current
    if (edgeRatioX) {
      const ratio = t.clientX / window.innerWidth
      if (ratio < edgeRatioX[0] || ratio > edgeRatioX[1]) return
    }
    startRef.current = { x: t.clientX, y: t.clientY, time: Date.now() }
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!startRef.current) return
    const t = e.changedTouches[0]
    const dx = t.clientX - startRef.current.x
    const dy = t.clientY - startRef.current.y
    const dt = Math.max(1, Date.now() - startRef.current.time)
    startRef.current = null

    const {
      onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown,
      distanceThreshold = 60,
      velocityThreshold = 0.3,
    } = optRef.current

    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)

    if (absDx >= absDy) {
      const velocity = absDx / dt
      if (absDx > distanceThreshold || velocity > velocityThreshold) {
        if (dx > 0) onSwipeRight?.()
        else onSwipeLeft?.()
      }
    } else {
      const velocity = absDy / dt
      if (absDy > distanceThreshold || velocity > velocityThreshold) {
        if (dy > 0) onSwipeDown?.()
        else onSwipeUp?.()
      }
    }
  }

  return { onTouchStart, onTouchEnd }
}
