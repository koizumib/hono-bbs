import type { Context } from 'hono'
import type { AppEnv, Board, Thread, Post } from '../types'

// isSysAdmin または isUserAdmin のみ adminMeta を参照できる
export function adminVisible(c: Context<AppEnv>): boolean {
  return c.get('isSysAdmin') || c.get('isUserAdmin')
}

function omitAdminMeta<T extends { adminMeta: unknown }>(resource: T): Omit<T, 'adminMeta'> {
  const { adminMeta: _dropped, ...rest } = resource
  return rest
}

export function stripBoard(board: Board, visible: boolean): Board | Omit<Board, 'adminMeta'> {
  return visible ? board : omitAdminMeta(board)
}

export function stripThread(thread: Thread, visible: boolean): Thread | Omit<Thread, 'adminMeta'> {
  return visible ? thread : omitAdminMeta(thread)
}

// 削除済み投稿のコンテンツをマスク (表示系フィールドを空文字に置換)
export function maskDeletedPost(post: Post): Post {
  if (!post.isDeleted) return post
  return { ...post, posterName: '', posterOptionInfo: '', authorId: '', content: '' }
}

export function stripPost(post: Post, visible: boolean): Post | Omit<Post, 'adminMeta'> {
  const masked = maskDeletedPost(post)
  return visible ? masked : omitAdminMeta(masked)
}
