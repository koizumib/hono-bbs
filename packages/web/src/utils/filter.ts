import type { Thread, Post } from '../api/types'

interface NgWords {
  threadTitle: string
  threadTitleRegex: boolean
  posterId: string
  posterIdRegex?: boolean
  posterName: string
  posterNameRegex?: boolean
  content: string
  contentRegex: boolean
}

// NGワード入力UIでの正規表現バリデーション表示にも使う (matchesNg と判定基準を揃えるため共通化)
export function isValidNgPattern(word: string, useRegex: boolean): boolean {
  if (!useRegex) return true
  try {
    new RegExp(word)
    return true
  } catch {
    return false
  }
}

function matchesNg(text: string, words: string, useRegex: boolean): boolean {
  if (!words.trim()) return false
  const lines = words.split('\n').filter((l) => l.trim())
  for (const word of lines) {
    if (!word.trim()) continue
    if (useRegex) {
      try {
        if (new RegExp(word).test(text)) return true
      } catch {
        // 無効な正規表現は無視
      }
    } else {
      if (text.includes(word)) return true
    }
  }
  return false
}

export function filterThreads(threads: Thread[], ng: NgWords): Thread[] {
  return threads.filter((t) => !matchesNg(t.title, ng.threadTitle, ng.threadTitleRegex))
}

export function filterPosts(posts: Post[], ng: NgWords): Post[] {
  return posts.filter((p) => {
    if (matchesNg(p.authorId, ng.posterId, ng.posterIdRegex ?? false)) return false
    if (matchesNg(p.posterName, ng.posterName, ng.posterNameRegex ?? false)) return false
    if (matchesNg(p.content, ng.content, ng.contentRegex)) return false
    return true
  })
}
