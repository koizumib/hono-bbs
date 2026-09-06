import type { Post, ResourceAcl } from '../types'
import type { DbAdapter } from '../adapters/db'

type PostRow = {
  id: string
  thread_id: string
  post_number: number
  acl: string
  author_id: string
  poster_name: string
  poster_option_info: string
  content: string
  is_deleted: number
  is_edited: number
  edited_at: string | null
  created_at: string
  creator_user_id: string | null
  creator_session_id: string | null
  creator_turnstile_session_id: string | null
}

function rowToPost(row: PostRow): Post {
  return {
    id: row.id,
    threadId: row.thread_id,
    postNumber: row.post_number,
    acl: JSON.parse(row.acl) as ResourceAcl,
    authorId: row.author_id,
    posterName: row.poster_name,
    posterOptionInfo: row.poster_option_info,
    content: row.content,
    isDeleted: row.is_deleted === 1,
    isEdited: row.is_edited === 1,
    editedAt: row.edited_at,
    createdAt: row.created_at,
    adminMeta: {
      creatorUserId: row.creator_user_id,
      creatorSessionId: row.creator_session_id,
      creatorTurnstileSessionId: row.creator_turnstile_session_id,
    },
  }
}

// limit/cursorページネーション。post_number は投稿順の連番なので、これ自体をカーソルとして使う。
export async function findPostsByThreadIdPage(
  db: DbAdapter,
  threadId: string,
  opts: { limit: number; afterPostNumber: number | null },
): Promise<{ items: Post[]; nextCursorRaw: number | null }> {
  const params: unknown[] = [threadId]
  let cursorClause = ''
  if (opts.afterPostNumber !== null) {
    cursorClause = ' AND post_number > ?'
    params.push(opts.afterPostNumber)
  }
  params.push(opts.limit + 1)

  const result = await db.all<PostRow>(
    `SELECT * FROM posts WHERE thread_id = ?${cursorClause} ORDER BY post_number ASC LIMIT ?`,
    params,
  )
  const hasMore = result.results.length > opts.limit
  const pageRows = hasMore ? result.results.slice(0, opts.limit) : result.results
  const last = pageRows[pageRows.length - 1]
  return {
    items: pageRows.map(rowToPost),
    nextCursorRaw: hasMore && last ? last.post_number : null,
  }
}

export async function findPostByNumber(
  db: DbAdapter,
  threadId: string,
  postNumber: number,
): Promise<Post | null> {
  const row = await db.first<PostRow>(
    'SELECT * FROM posts WHERE thread_id = ? AND post_number = ?',
    [threadId, postNumber],
  )
  return row ? rowToPost(row) : null
}

export async function nextPostNumber(db: DbAdapter, threadId: string): Promise<number> {
  const row = await db.first<{ next: number }>(
    'SELECT COALESCE(MAX(post_number), 0) + 1 AS next FROM posts WHERE thread_id = ?',
    [threadId],
  )
  return row?.next ?? 1
}

export async function insertPost(db: DbAdapter, post: Post): Promise<void> {
  await db.run(
    `INSERT INTO posts (
      id, thread_id, post_number, acl,
      author_id, poster_name, poster_option_info, content,
      is_deleted, is_edited, edited_at, created_at,
      creator_user_id, creator_session_id, creator_turnstile_session_id
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      post.id, post.threadId, post.postNumber,
      JSON.stringify(post.acl),
      post.authorId, post.posterName, post.posterOptionInfo,
      post.content, post.isDeleted ? 1 : 0, post.isEdited ? 1 : 0, post.editedAt,
      post.createdAt,
      post.adminMeta.creatorUserId, post.adminMeta.creatorSessionId, post.adminMeta.creatorTurnstileSessionId,
    ],
  )
}

// 投稿内容の冪等な置換 (PUT: content/posterName/posterOptionInfo + isEdited フラグ)
export async function updatePostContent(
  db: DbAdapter,
  threadId: string,
  postNumber: number,
  fields: { content: string; posterName: string; posterOptionInfo: string; editedAt: string },
): Promise<boolean> {
  const result = await db.run(
    `UPDATE posts SET content = ?, poster_name = ?, poster_option_info = ?, is_edited = 1, edited_at = ?
     WHERE thread_id = ? AND post_number = ?`,
    [fields.content, fields.posterName, fields.posterOptionInfo, fields.editedAt, threadId, postNumber],
  )
  return result.changes > 0
}

// 投稿メタデータの更新 (PATCH)
export async function patchPost(
  db: DbAdapter,
  threadId: string,
  postNumber: number,
  updates: {
    acl?: ResourceAcl
  },
): Promise<boolean> {
  const fields: string[] = []
  const values: unknown[] = []

  if (updates.acl !== undefined) { fields.push('acl = ?'); values.push(JSON.stringify(updates.acl)) }

  if (fields.length === 0) return true
  values.push(threadId, postNumber)
  const result = await db.run(
    `UPDATE posts SET ${fields.join(', ')} WHERE thread_id = ? AND post_number = ?`,
    values,
  )
  return result.changes > 0
}

// 投稿のソフト削除
export async function softDeletePost(
  db: DbAdapter,
  threadId: string,
  postNumber: number,
): Promise<boolean> {
  const result = await db.run(
    'UPDATE posts SET is_deleted = 1 WHERE thread_id = ? AND post_number = ?',
    [threadId, postNumber],
  )
  return result.changes > 0
}
