import { useEffect, useRef, useState } from 'react'

const DEFAULT_FLASH_MS = 1200

/**
 * 一覧が更新されたとき、前回のフェッチには無かったIDだけを一時的に返す。
 * 初回ロード時は「既知IDとして記録するだけ」で何もフラッシュしない
 * (初回表示で全件光ってしまうのを防ぐため)。
 *
 * resetKeyを渡すと、その値が変わった時点でも「初回ロード」と同じ扱いにして
 * 既知ID集合をリセットする。板を切り替えた場合など、idsの中身がまったく
 * 別集合に入れ替わる場面でboardIdを渡しておくと、以前の板のIDが残ったまま
 * 「全件新着」と誤判定してしまうのを防げる。
 */
export function useNewIdsFlash(ids: string[], resetKey?: string, flashMs: number = DEFAULT_FLASH_MS): Set<string> {
  const seenRef = useRef<Set<string> | null>(null)
  const lastResetKeyRef = useRef<string | undefined>(resetKey)
  const [flashing, setFlashing] = useState<Set<string>>(new Set())

  // idsの中身で比較したいが配列参照は毎回変わるので、join した文字列を安定した依存値にする
  useEffect(() => {
    if (resetKey !== lastResetKeyRef.current) {
      lastResetKeyRef.current = resetKey
      seenRef.current = null
    }
    const current = new Set(ids)
    if (seenRef.current === null) {
      seenRef.current = current
      return
    }
    const added: string[] = []
    for (const id of current) {
      if (!seenRef.current.has(id)) added.push(id)
    }
    seenRef.current = current
    if (added.length === 0) return
    setFlashing(new Set(added))
    const timer = setTimeout(() => setFlashing(new Set()), flashMs)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(','), resetKey, flashMs])

  return flashing
}
