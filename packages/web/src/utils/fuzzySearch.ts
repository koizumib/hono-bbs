// カタカナ → ひらがな変換
function toHiragana(str: string): string {
  return str.replace(/[\u30A1-\u30F6]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0x60)
  )
}

function normalize(str: string): string {
  return toHiragana(str).toLowerCase()
}

export function fuzzyMatch(text: string, query: string): boolean {
  if (!query.trim()) return true
  return normalize(text).includes(normalize(query))
}
