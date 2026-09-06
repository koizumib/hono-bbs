import type { PostRange } from '../repository/postRepository'

export type { PostRange }

// レンジ数の上限 (DoS 対策)
const MAX_POST_RANGES = 20

// "N", "N-", "N-M", "-N" の単一レンジをパース
function parseOneRange(s: string): PostRange | null {
  if (s.startsWith('-')) {
    // -N: 1 to N
    const n = parseInt(s.slice(1), 10)
    if (isNaN(n) || n < 1) return null
    return { from: 1, to: n }
  }
  if (s.endsWith('-')) {
    // N-: N to end
    const n = parseInt(s.slice(0, -1), 10)
    if (isNaN(n) || n < 1) return null
    return { from: n, to: null }
  }
  const dashIdx = s.indexOf('-')
  if (dashIdx !== -1) {
    // N-M
    const from = parseInt(s.slice(0, dashIdx), 10)
    const to = parseInt(s.slice(dashIdx + 1), 10)
    if (isNaN(from) || isNaN(to) || from < 1 || to < from) return null
    return { from, to }
  }
  // N: single
  const n = parseInt(s, 10)
  if (isNaN(n) || n < 1) return null
  return { from: n, to: n }
}

// カンマ区切りで複数レンジをパース。不正な値・上限超過は null を返す
// 例: "1-5,10,20-" → 複数レンジをカンマ区切り
export function parsePostRanges(param: string): PostRange[] | null {
  const parts = param.split(',').map(s => s.trim()).filter(Boolean)
  if (parts.length === 0 || parts.length > MAX_POST_RANGES) return null
  const ranges: PostRange[] = []
  for (const part of parts) {
    const r = parseOneRange(part)
    if (!r) return null
    ranges.push(r)
  }
  return ranges
}
