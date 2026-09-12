import { useCallback, useRef, useState } from 'react'
import { useSettingsStore } from '../stores/settingsStore'

export type SwipeDirection = 'up' | 'down' | 'left' | 'right'

export interface SwipeGestureBinding {
  /** ジェスチャー中に画面中央へ出すラベル（省略時は無表示） */
  label?: string
  /** 指を離した時、閾値を超えていれば呼ばれる */
  onCommit: () => void
  /**
   * 単一方向ジェスチャー専用: 既定の速度条件付き判定の代わりに、この距離(px、
   * 感度設定の倍率がかかる)だけ動けば速度に関係なく確定させたい場合に指定する。
   * (例: ポップアップを閉じる操作のように、ゆっくり動かしても反応してほしい場合)
   */
  minDistanceOverride?: number
}

// キーは方向シーケンスをカンマ区切りにした文字列 (例: 'right', 'right,up', 'left,up')。
// sequenceKey() で組み立てる。
export type SwipeGestureMap = Record<string, SwipeGestureBinding>

// 最初の方向を確定させるのに必要な移動量(px)
const LOCK_THRESHOLD = 8
// 「別の方向に切り替わった」と判定するための、区間ごとの移動量(px)
const SEGMENT_THRESHOLD = 16
// 指を触れたまま動きが無い状態がこの時間続いたらジェスチャーを中断する(ms)
const IDLE_TIMEOUT_MS = 1000
// 単一方向ジェスチャーの確定(コミット)判定: 画面幅/高さに対する比率、または最小距離+速度
const COMMIT_DISTANCE_RATIO = 0.4
const COMMIT_MIN_DISTANCE = 60
const COMMIT_MIN_VELOCITY = 0.5 // px/ms

// 設定の「ジェスチャー感度」(1=鈍い〜5=敏感)を、各しきい値に掛ける倍率に変換する。
// 3が既定値(倍率1.0=これまでの挙動)。数値が小さいほど、より小さな動きで
// ジェスチャーが発火するようになる。
const SENSITIVITY_MULTIPLIERS: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: 1.6,
  2: 1.3,
  3: 1.0,
  4: 0.7,
  5: 0.45,
}

function dominantDirection(dx: number, dy: number): SwipeDirection {
  return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : dy >= 0 ? 'down' : 'up'
}

export function sequenceKey(segs: SwipeDirection[]): string {
  return segs.join(',')
}

// segsがgesturesのいずれかのキーの「途中まで」に一致するか(=まだ続く可能性があるか)を調べる。
// ジェスチャー確定前でも、途中でスクロールに巻き込まれないようにpreventDefaultするために使う。
function matchesPrefix(gestures: SwipeGestureMap, segs: SwipeDirection[]): boolean {
  const prefix = sequenceKey(segs)
  return Object.keys(gestures).some((k) => k === prefix || k.startsWith(prefix + ','))
}

/**
 * 方向シーケンス（1方向、または複数方向の組み合わせ）を「登録されたジェスチャー」として
 * 認識する汎用フック。
 *
 * - ジェスチャー中に指が1秒止まったら中断する（離してからではなく、止まった時点で中断）。
 * - 指の動きの組み合わせ（例: →の後に↑など）に対応する動作が登録されていなければ、
 *   指を離しても何も起きない。
 * - どの方向も、最初にLOCK_THRESHOLDだけ動いた時点で「その方向」として確定し、以後は
 *   その区間の中でSEGMENT_THRESHOLDを超えて別方向に転じた場合だけ新しい区間を追加する
 *   （小さな指のブレで区間が増殖しないようにするため）。
 * - 単一方向ジェスチャーは指の移動距離/速度のしきい値で確定判定する(既存の戻る/進む等と同じ)。
 *   複数方向ジェスチャーは、各区間が既にSEGMENT_THRESHOLDを満たした時点で確定しているので、
 *   一致するシーケンスが登録されていればそのまま実行する。
 */
export function useSwipeGesture(gestures: SwipeGestureMap) {
  const [label, setLabel] = useState<string | null>(null)
  const startRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const segStartRef = useRef<{ x: number; y: number } | null>(null)
  const segmentsRef = useRef<SwipeDirection[]>([])
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  const gestureSensitivity = useSettingsStore((s) => s.gestureSensitivity)
  const sensitivityMult = SENSITIVITY_MULTIPLIERS[gestureSensitivity]
  const lockThreshold = LOCK_THRESHOLD * sensitivityMult
  const segmentThreshold = SEGMENT_THRESHOLD * sensitivityMult
  const commitDistanceRatio = COMMIT_DISTANCE_RATIO * sensitivityMult
  const commitMinDistance = COMMIT_MIN_DISTANCE * sensitivityMult
  const commitMinVelocity = COMMIT_MIN_VELOCITY * sensitivityMult

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current)
      idleTimerRef.current = null
    }
  }, [])

  const cancel = useCallback(() => {
    startRef.current = null
    segStartRef.current = null
    segmentsRef.current = []
    clearIdleTimer()
    setLabel(null)
  }, [clearIdleTimer])

  const resetIdleTimer = useCallback(() => {
    clearIdleTimer()
    idleTimerRef.current = setTimeout(cancel, IDLE_TIMEOUT_MS)
  }, [cancel, clearIdleTimer])

  function onTouchStart(e: React.TouchEvent<HTMLElement>) {
    const t = e.touches[0]
    startRef.current = { x: t.clientX, y: t.clientY, time: Date.now() }
    segStartRef.current = { x: t.clientX, y: t.clientY }
    segmentsRef.current = []
    resetIdleTimer()

    const target = e.currentTarget
    function onMove(ev: TouchEvent) {
      if (!segStartRef.current) return
      resetIdleTimer()
      const t2 = ev.touches[0]
      const dxSeg = t2.clientX - segStartRef.current.x
      const dySeg = t2.clientY - segStartRef.current.y
      const dist = Math.hypot(dxSeg, dySeg)
      const segs = segmentsRef.current

      if (segs.length === 0) {
        if (dist < lockThreshold) return
        const dir = dominantDirection(dxSeg, dySeg)
        segs.push(dir)
        segStartRef.current = { x: t2.clientX, y: t2.clientY }
        setLabel(gestures[sequenceKey(segs)]?.label ?? null)
      } else if (dist >= segmentThreshold) {
        const dir = dominantDirection(dxSeg, dySeg)
        if (dir !== segs[segs.length - 1]) {
          segs.push(dir)
          setLabel(gestures[sequenceKey(segs)]?.label ?? null)
        }
        segStartRef.current = { x: t2.clientX, y: t2.clientY }
      }

      // 今の区間シーケンスが登録済みジェスチャーの一部(またはそのもの)なら、指が多少ブレても
      // スクロールを巻き込まないようにする
      if (segs.length >= 1 && matchesPrefix(gestures, segs)) ev.preventDefault()
    }
    target.addEventListener('touchmove', onMove, { passive: false })
    cleanupRef.current = () => target.removeEventListener('touchmove', onMove)
  }

  function onTouchEnd(e: React.TouchEvent) {
    cleanupRef.current?.()
    cleanupRef.current = null
    clearIdleTimer()
    const start = startRef.current
    const segs = segmentsRef.current
    startRef.current = null
    segStartRef.current = null
    segmentsRef.current = []
    setLabel(null)
    if (!start || segs.length === 0) return
    const binding = gestures[sequenceKey(segs)]
    if (!binding) return

    if (segs.length === 1) {
      // 単一方向ジェスチャー: 全体の移動距離/速度のしきい値で確定判定する
      const dir = segs[0]
      const t = e.changedTouches[0]
      const dx = t.clientX - start.x
      const dy = t.clientY - start.y
      const isHorizontal = dir === 'left' || dir === 'right'
      const distance = isHorizontal ? Math.abs(dx) : Math.abs(dy)
      if (binding.minDistanceOverride !== undefined) {
        // 速度を問わず、距離だけで確定する(ゆっくりしたドラッグでも反応してほしい場合)
        if (distance > binding.minDistanceOverride * sensitivityMult) binding.onCommit()
      } else {
        const dt = Math.max(1, Date.now() - start.time)
        const velocity = distance / dt
        const viewportSize = isHorizontal ? window.innerWidth : window.innerHeight
        if (distance > viewportSize * commitDistanceRatio || (distance > commitMinDistance && velocity > commitMinVelocity)) {
          binding.onCommit()
        }
      }
    } else {
      // 複合ジェスチャー: 各区間が既にSEGMENT_THRESHOLDを満たしているので、そのまま確定する
      binding.onCommit()
    }
  }

  return { onTouchStart, onTouchEnd, label, cancel }
}
