import type { Board, ResourceAcl } from '../types'
import type { DbAdapter } from '../adapters/db'

type BoardRow = {
  id: string
  acl: string
  name: string
  description: string
  max_threads: number
  max_thread_title_length: number
  default_max_posts: number
  default_max_post_length: number
  default_max_post_lines: number
  default_max_poster_name_length: number
  default_max_poster_option_length: number
  default_poster_name: string
  default_id_format: string
  default_thread_acl: string
  default_post_acl: string
  category: string
  created_at: string
  creator_user_id: string | null
  creator_session_id: string | null
  creator_turnstile_session_id: string | null
}

function rowToBoard(row: BoardRow): Board {
  return {
    id: row.id,
    acl: JSON.parse(row.acl) as ResourceAcl,
    name: row.name,
    description: row.description,
    maxThreads: row.max_threads,
    maxThreadTitleLength: row.max_thread_title_length,
    defaultMaxPosts: row.default_max_posts,
    defaultMaxPostLength: row.default_max_post_length,
    defaultMaxPostLines: row.default_max_post_lines,
    defaultMaxPosterNameLength: row.default_max_poster_name_length,
    defaultMaxPosterOptionLength: row.default_max_poster_option_length,
    defaultPosterName: row.default_poster_name,
    defaultIdFormat: row.default_id_format as Board['defaultIdFormat'],
    defaultThreadAcl: JSON.parse(row.default_thread_acl) as ResourceAcl,
    defaultPostAcl: JSON.parse(row.default_post_acl) as ResourceAcl,
    category: row.category,
    createdAt: row.created_at,
    adminMeta: {
      creatorUserId: row.creator_user_id,
      creatorSessionId: row.creator_session_id,
      creatorTurnstileSessionId: row.creator_turnstile_session_id,
    },
  }
}

export async function findBoardById(db: DbAdapter, id: string): Promise<Board | null> {
  const row = await db.first<BoardRow>('SELECT * FROM boards WHERE id = ?', [id])
  return row ? rowToBoard(row) : null
}

export type BoardCursor = { createdAt: string; id: string }

// limit/cursorページネーション。created_at DESC, id DESC の複合キーでキーセットページングする。
// limit+1件取得して次ページの有無を判定する (COUNTクエリ不要)。
export async function findBoardsPage(
  db: DbAdapter,
  opts: { limit: number; cursor: BoardCursor | null },
): Promise<{ items: Board[]; nextCursorRaw: BoardCursor | null }> {
  const params: unknown[] = []
  let sql = 'SELECT * FROM boards'
  if (opts.cursor) {
    sql += ' WHERE (created_at < ? OR (created_at = ? AND id < ?))'
    params.push(opts.cursor.createdAt, opts.cursor.createdAt, opts.cursor.id)
  }
  sql += ' ORDER BY created_at DESC, id DESC LIMIT ?'
  params.push(opts.limit + 1)

  const result = await db.all<BoardRow>(sql, params)
  const hasMore = result.results.length > opts.limit
  const pageRows = hasMore ? result.results.slice(0, opts.limit) : result.results
  const last = pageRows[pageRows.length - 1]
  return {
    items: pageRows.map(rowToBoard),
    nextCursorRaw: hasMore && last ? { createdAt: last.created_at, id: last.id } : null,
  }
}

export type BoardWriteFields = {
  acl?: ResourceAcl
  name?: string
  description?: string
  maxThreads?: number
  maxThreadTitleLength?: number
  defaultMaxPosts?: number
  defaultMaxPostLength?: number
  defaultMaxPostLines?: number
  defaultMaxPosterNameLength?: number
  defaultMaxPosterOptionLength?: number
  defaultPosterName?: string
  defaultIdFormat?: string
  defaultThreadAcl?: ResourceAcl
  defaultPostAcl?: ResourceAcl
  category?: string
}

export async function insertBoard(db: DbAdapter, board: Board): Promise<void> {
  await db.run(
    `INSERT INTO boards (
      id, acl, name, description,
      max_threads, max_thread_title_length,
      default_max_posts, default_max_post_length, default_max_post_lines,
      default_max_poster_name_length, default_max_poster_option_length,
      default_poster_name, default_id_format,
      default_thread_acl, default_post_acl,
      category, created_at, creator_user_id, creator_session_id, creator_turnstile_session_id
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      board.id, JSON.stringify(board.acl), board.name, board.description,
      board.maxThreads, board.maxThreadTitleLength,
      board.defaultMaxPosts, board.defaultMaxPostLength, board.defaultMaxPostLines,
      board.defaultMaxPosterNameLength, board.defaultMaxPosterOptionLength,
      board.defaultPosterName, board.defaultIdFormat,
      JSON.stringify(board.defaultThreadAcl), JSON.stringify(board.defaultPostAcl),
      board.category, board.createdAt,
      board.adminMeta.creatorUserId, board.adminMeta.creatorSessionId, board.adminMeta.creatorTurnstileSessionId,
    ],
  )
}

export async function updateBoard(db: DbAdapter, id: string, f: BoardWriteFields): Promise<boolean> {
  const fields: string[] = []
  const values: unknown[] = []

  if (f.acl !== undefined)                      { fields.push('acl = ?');                          values.push(JSON.stringify(f.acl)) }
  if (f.name !== undefined)                     { fields.push('name = ?');                         values.push(f.name) }
  if (f.description !== undefined)              { fields.push('description = ?');                  values.push(f.description) }
  if (f.maxThreads !== undefined)               { fields.push('max_threads = ?');                  values.push(f.maxThreads) }
  if (f.maxThreadTitleLength !== undefined)     { fields.push('max_thread_title_length = ?');      values.push(f.maxThreadTitleLength) }
  if (f.defaultMaxPosts !== undefined)          { fields.push('default_max_posts = ?');            values.push(f.defaultMaxPosts) }
  if (f.defaultMaxPostLength !== undefined)     { fields.push('default_max_post_length = ?');      values.push(f.defaultMaxPostLength) }
  if (f.defaultMaxPostLines !== undefined)      { fields.push('default_max_post_lines = ?');       values.push(f.defaultMaxPostLines) }
  if (f.defaultMaxPosterNameLength !== undefined)   { fields.push('default_max_poster_name_length = ?');   values.push(f.defaultMaxPosterNameLength) }
  if (f.defaultMaxPosterOptionLength !== undefined) { fields.push('default_max_poster_option_length = ?'); values.push(f.defaultMaxPosterOptionLength) }
  if (f.defaultPosterName !== undefined)        { fields.push('default_poster_name = ?');          values.push(f.defaultPosterName) }
  if (f.defaultIdFormat !== undefined)          { fields.push('default_id_format = ?');            values.push(f.defaultIdFormat) }
  if (f.defaultThreadAcl !== undefined)          { fields.push('default_thread_acl = ?');           values.push(JSON.stringify(f.defaultThreadAcl)) }
  if (f.defaultPostAcl !== undefined)            { fields.push('default_post_acl = ?');             values.push(JSON.stringify(f.defaultPostAcl)) }
  if (f.category !== undefined)                 { fields.push('category = ?');                     values.push(f.category) }

  if (fields.length === 0) return true
  values.push(id)
  const result = await db.run(`UPDATE boards SET ${fields.join(', ')} WHERE id = ?`, values)
  return result.changes > 0
}

export async function deleteBoard(db: DbAdapter, id: string): Promise<boolean> {
  const result = await db.run('DELETE FROM boards WHERE id = ?', [id])
  return result.changes > 0
}
