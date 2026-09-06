import type { Thread, Post } from '../api/types'

interface NgWords {
  threadTitle: string
  threadTitleRegex: boolean
  posterId: string
  posterName: string
  content: string
  contentRegex: boolean
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
    if (matchesNg(p.authorId, ng.posterId, false)) return false
    if (matchesNg(p.posterName, ng.posterName, false)) return false
    if (matchesNg(p.content, ng.content, ng.contentRegex)) return false
    return true
  })
}
