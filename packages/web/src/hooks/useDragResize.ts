import { useCallback, useRef, useState } from 'react'

function getStoredSize(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function setStoredSize(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // ignore
  }
}

interface UseDragResizeOptions {
  /** localStorage に保存するキー名 */
  storageKey: string
  defaultSize: number
  direction: 'horizontal' | 'vertical'
  /** true のとき、原点方向（上・左）に動かすとサイズが増える */
  inverted?: boolean
  min: number
  max: number
}

export function useDragResize({
  storageKey,
  defaultSize,
  direction,
  inverted = false,
  min,
  max,
}: UseDragResizeOptions) {
  const [size, setSize] = useState(() => {
    const saved = getStoredSize(storageKey)
    if (saved) {
      const n = parseFloat(saved)
      if (!isNaN(n) && n >= min && n <= max) return n
    }
    return defaultSize
  })

  const startPos = useRef(0)
  const startSize = useRef(0)

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      startPos.current = direction === 'horizontal' ? e.clientX : e.clientY
      startSize.current = size

      document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize'
      document.body.style.userSelect = 'none'

      const calc = (ev: MouseEvent) => {
        const pos = direction === 'horizontal' ? ev.clientX : ev.clientY
        const raw = inverted ? startPos.current - pos : pos - startPos.current
        return Math.min(max, Math.max(min, startSize.current + raw))
      }

      const onMouseMove = (ev: MouseEvent) => setSize(calc(ev))

      const onMouseUp = (ev: MouseEvent) => {
        const final = calc(ev)
        setSize(final)
        setStoredSize(storageKey, String(Math.round(final)))
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)
      }

      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    },
    [size, direction, inverted, min, max, storageKey],
  )

  return { size, onMouseDown }
}
