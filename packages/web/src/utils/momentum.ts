import type { Thread } from '../api/types'

// 勢い = レス数 / 経過時間(時間)。
// ThreadCardの表示（炎アイコンの色・ツールチップ）とスレッド一覧のソート処理の
// 両方が必ずこの関数を使うようにする。以前はソート側だけ「1日未満は1日として
// 丸める」clampを使っていて、表示側（0.01時間でclamp、実質ほぼ丸めない）と
// 基準が違ったため、24時間以内のスレッド同士で表示の炎の強さとソート順が
// 食い違うことがあった。
export function calculateMomentum(thread: Thread): number {
  const createdAt = thread.firstPost?.createdAt ?? thread.createdAt
  const hours = (Date.now() - new Date(createdAt).getTime()) / 3_600_000
  return thread.postCount / Math.max(0.01, hours)
}

// 勢いは母集団(板・サイト全体等)ごとに絶対値の桁が大きく変わる(過疎板は勢い5でも
// 一番盛り上がっている、大手板は勢い50でもまだ平均的、ということがザラにある)ため、
// 固定の閾値で色付けすると過疎板ではどのスレッドも常に無色になってしまう。そこで
// 「この母集団の中で何番目に勢いがあるか」という相対順位(0=最下位, 1=最上位)を返し、
// 色付けはこれを使う。
export function rankMomentumValues(ids: string[], values: number[]): Map<string, number> {
  const withValue = ids.map((id, i) => ({ id, v: values[i] }))
  const sorted = [...withValue].sort((a, b) => a.v - b.v)
  const n = sorted.length
  const rankMap = new Map<string, number>()
  sorted.forEach((entry, i) => {
    rankMap.set(entry.id, n <= 1 ? 1 : i / (n - 1))
  })
  return rankMap
}

// 同じboard内のスレッド一覧(NGワードで隠されているものは除く)全体を渡すこと。
export function rankMomentum(threads: Thread[]): Map<string, number> {
  return rankMomentumValues(threads.map((t) => t.id), threads.map((t) => calculateMomentum(t)))
}
