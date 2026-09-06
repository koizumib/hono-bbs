import { classifyUrl } from './urlExtract'

/**
 * サーバーから受け取ったコンテンツを表示用にプリプロセスする。
 * - <br> / <br/> タグを改行文字に変換
 * - &#129412; や &#x1F984; のような数値文字参照を実際の文字に変換
 * DOMに依存しない純粋関数。
 */
function preprocessContent(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
}

/**
 * テキストから絵文字を分離して 'text' / 'emoji' 交互のセグメントに分割する。
 * \p{Emoji_Presentation} = デフォルトで絵文字として表示される文字（数字・記号を除く）。
 * その後ろに続く変化セレクタ・肌色修飾子も1まとまりとして扱う。
 */
function splitTextByEmoji(text: string): Array<{ type: 'text' | 'emoji'; text: string }> {
  // バリエーションセレクタ(FE0F/FE0E)、肌色修飾子(1F3FB-1F3FF)、ZWJ(200D)を含む絵文字シーケンスを1トークンとして抽出
  const re = /\p{Emoji_Presentation}[\u{FE0F}\u{FE0E}\u{1F3FB}-\u{1F3FF}\u{200D}\u{20E3}]*/gu
  const result: Array<{ type: 'text' | 'emoji'; text: string }> = []
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      result.push({ type: 'text', text: text.slice(last, m.index) })
    }
    result.push({ type: 'emoji', text: m[0] })
    last = re.lastIndex
  }
  if (last < text.length) {
    result.push({ type: 'text', text: text.slice(last) })
  }
  return result
}

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'emoji'; text: string }
  | { type: 'anchor'; raw: string; numbers: number[] }
  | { type: 'url'; url: string; linkType: 'image' | 'twitter' | 'youtube' | 'url' }

function expandAnchorStr(str: string): number[] {
  const nums: number[] = []
  for (const part of str.split(',')) {
    const rangeMatch = part.match(/^(\d+)-(\d+)$/)
    if (rangeMatch) {
      const s = parseInt(rangeMatch[1])
      const e = parseInt(rangeMatch[2])
      const limit = Math.min(e, s + 50)
      for (let i = s; i <= limit; i++) nums.push(i)
    } else {
      const n = parseInt(part)
      if (!isNaN(n)) nums.push(n)
    }
  }
  return [...new Set(nums)]
}

export function tokenizeContent(rawContent: string): ContentPart[] {
  const content = preprocessContent(rawContent)
  const rawParts: ContentPart[] = []
  // URL must match before anchors (priority)
  const combinedRe = /(https?:\/\/[^\s<>"]+)|(>>?\d[\d,\-]*)/g
  let lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = combinedRe.exec(content)) !== null) {
    if (m.index > lastIndex) {
      rawParts.push({ type: 'text', text: content.slice(lastIndex, m.index) })
    }
    if (m[1]) {
      const url = m[1]
      rawParts.push({ type: 'url', url, linkType: classifyUrl(url) })
    } else if (m[2]) {
      const raw = m[2]
      const afterGt = raw.replace(/^>>?/, '')
      const numbers = expandAnchorStr(afterGt)
      rawParts.push({ type: 'anchor', raw, numbers })
    }
    lastIndex = combinedRe.lastIndex
  }
  if (lastIndex < content.length) {
    rawParts.push({ type: 'text', text: content.slice(lastIndex) })
  }

  // text パートをさらに絵文字/テキストに分割
  const result: ContentPart[] = []
  for (const part of rawParts) {
    if (part.type === 'text') {
      result.push(...splitTextByEmoji(part.text))
    } else {
      result.push(part)
    }
  }
  return result
}

export function parseAnchorsFromContent(content: string): number[] {
  const parts = tokenizeContent(content)
  return parts
    .filter((p): p is { type: 'anchor'; raw: string; numbers: number[] } => p.type === 'anchor')
    .flatMap((p) => p.numbers)
}

export function buildAnchorTree(
  startNumber: number,
  allPosts: { postNumber: number; content: string }[],
): number[] {
  const anchorsTo = new Map<number, number[]>()
  const anchoredBy = new Map<number, number[]>()

  for (const post of allPosts) {
    const nums = parseAnchorsFromContent(post.content)
    anchorsTo.set(post.postNumber, nums)
    for (const n of nums) {
      const existing = anchoredBy.get(n) ?? []
      existing.push(post.postNumber)
      anchoredBy.set(n, existing)
    }
  }

  const visited = new Set<number>([startNumber])
  const queue = [startNumber]
  while (queue.length > 0) {
    const current = queue.shift()!
    const neighbors = [...(anchorsTo.get(current) ?? []), ...(anchoredBy.get(current) ?? [])]
    for (const n of neighbors) {
      if (!visited.has(n)) {
        visited.add(n)
        queue.push(n)
      }
    }
  }

  return [...visited].sort((a, b) => a - b)
}
