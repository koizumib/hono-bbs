// ゼロ幅文字・双方向制御文字(RLO/LRO等)を除去する。
// これらは画面上見えない/表示順序を偽装できるため、匿名掲示板では
// (1) NGワードフィルタの回避 (例: 禁止語の間にゼロ幅スペースを挟む)
// (2) 拡張子偽装などの表示偽装 (例: RLOで "txt.exe" を "exe.txt" のように見せる)
// の両方に悪用される。投稿の受付時(NGワード判定・保存の前)に一律で取り除く。
//
// コードポイントを10進/16進の数値リテラルとしてのみ扱い、このファイルのソース自体には
// 対象の見えない文字そのものを一切埋め込まない(diff/エディタでの見落とし・データ破損を防ぐため)。
const DANGEROUS_CODE_POINTS = new Set<number>([
  0x200b, // ZERO WIDTH SPACE
  0x200c, // ZERO WIDTH NON-JOINER
  0x200d, // ZERO WIDTH JOINER
  0x200e, // LEFT-TO-RIGHT MARK
  0x200f, // RIGHT-TO-LEFT MARK
  0x202a, // LEFT-TO-RIGHT EMBEDDING
  0x202b, // RIGHT-TO-LEFT EMBEDDING
  0x202c, // POP DIRECTIONAL FORMATTING
  0x202d, // LEFT-TO-RIGHT OVERRIDE
  0x202e, // RIGHT-TO-LEFT OVERRIDE
  0x2060, // WORD JOINER
  0x2061, 0x2062, 0x2063, 0x2064, // 不可視の数学演算子
  0x2066, // LEFT-TO-RIGHT ISOLATE
  0x2067, // RIGHT-TO-LEFT ISOLATE
  0x2068, // FIRST STRONG ISOLATE
  0x2069, // POP DIRECTIONAL ISOLATE
  0xfeff, // ZERO WIDTH NO-BREAK SPACE (BOM)
])

export function stripDangerousUnicode(text: string): string {
  let out = ''
  for (const ch of text) {
    const cp = ch.codePointAt(0)
    if (cp !== undefined && DANGEROUS_CODE_POINTS.has(cp)) continue
    out += ch
  }
  return out
}
