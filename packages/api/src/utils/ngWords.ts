import type { NgWordRule, NgWordTarget } from '../types'

function matchesPattern(text: string, rule: NgWordRule): boolean {
  if (rule.isRegex) {
    try {
      return new RegExp(rule.pattern).test(text)
    } catch {
      // 無効な正規表現は無視 (マッチしない扱い)
      return false
    }
  }
  return text.includes(rule.pattern)
}

// board.ngWords のうち、指定した target に一致するルールが1つでもあれば true を返す。
// クライアント側のNGワード機能 (utils/filter.ts, packages/web) とは別物で、こちらは
// 実際に投稿の作成自体を拒否するサーバー側の仕組み。
export function matchesAnyNgWord(rules: NgWordRule[], target: NgWordTarget, text: string): boolean {
  return rules.some((r) => r.target === target && matchesPattern(text, r))
}
