import { useState, useEffect } from 'react'

/** 画面幅 768px 未満のとき true を返す（レスポンシブ切り替え用） */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 768,
  )

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    setIsMobile(mq.matches)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return isMobile
}
