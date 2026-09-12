export type SortDir = 'asc' | 'desc'

export interface SortState<T extends string> {
  mode: T
  dir: SortDir
}

/**
 * ソートボタンの状態を「昇順 → 降順 → オフ」の3状態で巡回させる。
 * 別のモードのボタンが押された場合は、そのモードの昇順から仕切り直す。
 */
export function cycleSort<T extends string>(current: SortState<T> | null, mode: T): SortState<T> | null {
  if (!current || current.mode !== mode) return { mode, dir: 'asc' }
  if (current.dir === 'asc') return { mode, dir: 'desc' }
  return null
}
