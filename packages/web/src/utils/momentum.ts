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
