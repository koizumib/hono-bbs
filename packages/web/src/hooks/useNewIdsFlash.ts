import { useEffect, useRef, useState } from 'react'

const DEFAULT_FLASH_MS = 1200

export interface NewIdsFlashResult {
  /** 前回の一覧取得時から新たに現れたID。次に一覧を再取得するまで消えない(「新着」ドット用) */
  newSinceLastLoad: Set<string>
  /** 新たに現れた直後だけ(flashMs間)trueになる。一覧が更新され続ける限りは同じ値を保持し続けない
   *  (光る演出=flash-newクラス用。ドットの永続表示とは別物) */
  flashingNow: Set<string>
}

/**
 * 一覧が更新されたとき、前回のフェッチには無かったIDを検知する。
 * 初回ロード時は「既知IDとして記録するだけ」で何も新着扱いにしない
 * (初回表示で全件が新着判定されてしまうのを防ぐため)。
 *
 * fetchVersion(react-queryのdataUpdatedAt等、フェッチが完了するたびに変わる値)を
 * 依存値にして「実際にフェッチが完了したタイミング」でだけ判定し直す。以前はids配列の
 * 中身(joinした文字列)だけを依存値にしていたため、「新着が無かった回」はidsの中身が
 * 前回と完全に同じになり、effect自体が再実行されず、前回までの新着マーカーが
 * クリアされないまま残ってしまう不具合があった(リロードしても新着が無い場合に
 * 古いポチが消えないバグの原因)。
 *
 * enabled=falseの間(例: react-queryがまだ読み込み中で、idsが「本物のデータ」ではなく
 * 一時的な空配列のプレースホルダーになっている間)は一切処理しない。ここでenabledを
 * 見ずにidsだけで判定すると、「空配列(ローディング中)」を初回の既知集合として記録した後、
 * 実データが届いた瞬間に「全件が新着」と誤検知してしまう(ブラウザリロード時に全スレッドが
 * 新着扱いされる不具合の原因だった)。
 *
 * resetKeyを渡すと、その値が変わった時点でも「初回ロード」と同じ扱いにして
 * 既知ID集合をリセットする。板を切り替えた場合など、idsの中身がまったく
 * 別集合に入れ替わる場面でboardIdを渡しておくと、以前の板のIDが残ったまま
 * 「全件新着」と誤判定してしまうのを防げる。
 */
export function useNewIdsFlash(
  ids: string[],
  fetchVersion: number | undefined,
  resetKey?: string,
  flashMs: number = DEFAULT_FLASH_MS,
  enabled: boolean = true,
): NewIdsFlashResult {
  const seenRef = useRef<Set<string> | null>(null)
  const lastResetKeyRef = useRef<string | undefined>(resetKey)
  const idsRef = useRef<string[]>(ids)
  idsRef.current = ids
  const [newSinceLastLoad, setNewSinceLastLoad] = useState<Set<string>>(new Set())
  const [flashingNow, setFlashingNow] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!enabled) return

    if (resetKey !== lastResetKeyRef.current) {
      lastResetKeyRef.current = resetKey
      seenRef.current = null
      setNewSinceLastLoad(new Set())
    }
    const current = new Set(idsRef.current)
    if (seenRef.current === null) {
      seenRef.current = current
      return
    }
    const added: string[] = []
    for (const id of current) {
      if (!seenRef.current.has(id)) added.push(id)
    }
    seenRef.current = current

    // 今回の取得で新しく現れた分だけを「次にリロードするまで消えないマーカー」として置き換える
    // (前回までの新着マーカーはこの取得時点で「もう新着ではない」ので引き継がない。
    // addedが空でも必ず置き換えることで、「新着が無かった回」は前回分もきちんと消える)
    setNewSinceLastLoad(new Set(added))

    if (added.length === 0) {
      setFlashingNow(new Set())
      return
    }
    setFlashingNow(new Set(added))
    const timer = setTimeout(() => setFlashingNow(new Set()), flashMs)
    return () => clearTimeout(timer)
  }, [fetchVersion, resetKey, flashMs, enabled])

  return { newSinceLastLoad, flashingNow }
}
