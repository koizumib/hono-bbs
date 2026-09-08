import type { Thread, Post } from '../api/types'
import type { NgRule, NgTarget } from '../stores/settingsStore'

// NGワード入力UIでの正規表現バリデーション表示にも使う (matchesText と判定基準を揃えるため共通化)
export function isValidNgPattern(pattern: string, useRegex: boolean): boolean {
  if (!useRegex) return true
  try {
    new RegExp(pattern)
    return true
  } catch {
    return false
  }
}

function matchesText(text: string, pattern: string, useRegex: boolean): boolean {
  if (!pattern.trim()) return false
  if (useRegex) {
    try {
      return new RegExp(pattern).test(text)
    } catch {
      return false
    }
  }
  return text.includes(pattern)
}

function activeRulesFor(rules: NgRule[], target: NgTarget): NgRule[] {
  return rules.filter((r) => r.enabled && r.target === target)
}

export function filterThreads(threads: Thread[], rules: NgRule[]): Thread[] {
  const active = activeRulesFor(rules, 'threadTitle')
  if (active.length === 0) return threads
  return threads.filter((t) => !active.some((r) => matchesText(t.title, r.pattern, r.isRegex)))
}

export function filterPosts(posts: Post[], rules: NgRule[]): Post[] {
  const idRules = activeRulesFor(rules, 'posterId')
  const nameRules = activeRulesFor(rules, 'posterName')
  const contentRules = activeRulesFor(rules, 'content')
  if (idRules.length === 0 && nameRules.length === 0 && contentRules.length === 0) return posts
  return posts.filter((p) => {
    if (idRules.some((r) => matchesText(p.authorId, r.pattern, r.isRegex))) return false
    if (nameRules.some((r) => matchesText(p.posterName, r.pattern, r.isRegex))) return false
    if (contentRules.some((r) => matchesText(p.content, r.pattern, r.isRegex))) return false
    return true
  })
}
