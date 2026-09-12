import type { Board, ResourceAcl, NgWordRule } from '../types'
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
  ng_words: string
  category: string
  icon: string | null
  color_theme: string | null
  created_at: string
  creator_user_id: string | null
  creator_session_id: string | null
  creator_turnstile_session_id: string | null
  thread_count: number
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
    ngWords: JSON.parse(row.ng_words) as NgWordRule[],
    category: row.category,
    icon: row.icon,
    colorTheme: row.color_theme,
    threadCount: row.thread_count,
    createdAt: row.created_at,
    adminMeta: {
      creatorUserId: row.creator_user_id,
      creatorSessionId: row.creator_session_id,
      creatorTurnstileSessionId: row.creator_turnstile_session_id,
    },
  }
}

// 板ごとのスレ数は保存カラムではなく都度この相関サブクエリで数える (更新のたびに
// カウンタを持ち直す必要がなく、一覧・詳細どちらでも常に正確な値になる)
const THREAD_COUNT_SUBQUERY_EXPR = 'SELECT COUNT(*) FROM threads t WHERE t.board_id = b.id'
const THREAD_COUNT_SUBQUERY = `(${THREAD_COUNT_SUBQUERY_EXPR}) AS thread_count`

export async function findBoardById(db: DbAdapter, id: string): Promise<Board | null> {
  const row = await db.first<BoardRow>(
    `SELECT b.*, ${THREAD_COUNT_SUBQUERY} FROM boards b WHERE b.id = ?`,
    [id],
  )
  return row ? rowToBoard(row) : null
}

export type BoardCursor = { createdAt: string; id: string; threadCount?: number }
export type BoardListFilters = { q?: string; category?: string; sort?: 'newest' | 'popular' }

// LIKE検索でユーザー入力中の %/_/\ をワイルドカードとして解釈させないためのエスケープ
function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_]/g, (ch) => `\\${ch}`)
}

// limit/cursorページネーション。created_at DESC, id DESC の複合キーでキーセットページングする。
// limit+1件取得して次ページの有無を判定する (COUNTクエリ不要)。
export async function findBoardsPage(
  db: DbAdapter,
  opts: { limit: number; cursor: BoardCursor | null; filters?: BoardListFilters },
): Promise<{ items: Board[]; nextCursorRaw: BoardCursor | null }> {
  const sort = opts.filters?.sort ?? 'newest'
  const params: unknown[] = []
  const whereParts: string[] = []

  if (opts.filters?.q) {
    whereParts.push("(b.name LIKE ? ESCAPE '\\' OR b.id LIKE ? ESCAPE '\\')")
    const likeParam = `%${escapeLikePattern(opts.filters.q)}%`
    params.push(likeParam, likeParam)
  }
  if (opts.filters?.category) {
    whereParts.push('b.category = ?')
    params.push(opts.filters.category)
  }

  if (opts.cursor) {
    if (sort === 'popular' && opts.cursor.threadCount !== undefined) {
      // thread_countはSELECT句のエイリアスなのでWHERE句では使えず、同じ相関サブクエリを繰り返す
      whereParts.push(
        `((${THREAD_COUNT_SUBQUERY_EXPR}) < ? OR ((${THREAD_COUNT_SUBQUERY_EXPR}) = ? AND b.id < ?))`,
      )
      params.push(opts.cursor.threadCount, opts.cursor.threadCount, opts.cursor.id)
    } else if (sort !== 'popular') {
      whereParts.push('(b.created_at < ? OR (b.created_at = ? AND b.id < ?))')
      params.push(opts.cursor.createdAt, opts.cursor.createdAt, opts.cursor.id)
    }
  }

  let sql = `SELECT b.*, ${THREAD_COUNT_SUBQUERY} FROM boards b`
  if (whereParts.length > 0) sql += ' WHERE ' + whereParts.join(' AND ')
  sql += sort === 'popular' ? ' ORDER BY thread_count DESC, b.id DESC LIMIT ?' : ' ORDER BY b.created_at DESC, b.id DESC LIMIT ?'
  params.push(opts.limit + 1)

  const result = await db.all<BoardRow>(sql, params)
  const hasMore = result.results.length > opts.limit
  const pageRows = hasMore ? result.results.slice(0, opts.limit) : result.results
  const last = pageRows[pageRows.length - 1]
  return {
    items: pageRows.map(rowToBoard),
    nextCursorRaw: hasMore && last
      ? { createdAt: last.created_at, id: last.id, threadCount: last.thread_count }
      : null,
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
  ngWords?: NgWordRule[]
  category?: string
  icon?: string | null
  colorTheme?: string | null
}

export async function insertBoard(db: DbAdapter, board: Board): Promise<void> {
  await db.run(
    `INSERT INTO boards (
      id, acl, name, description,
      max_threads, max_thread_title_length,
      default_max_posts, default_max_post_length, default_max_post_lines,
      default_max_poster_name_length, default_max_poster_option_length,
      default_poster_name, default_id_format,
      default_thread_acl, default_post_acl, ng_words,
      category, icon, color_theme, created_at, creator_user_id, creator_session_id, creator_turnstile_session_id
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      board.id, JSON.stringify(board.acl), board.name, board.description,
      board.maxThreads, board.maxThreadTitleLength,
      board.defaultMaxPosts, board.defaultMaxPostLength, board.defaultMaxPostLines,
      board.defaultMaxPosterNameLength, board.defaultMaxPosterOptionLength,
      board.defaultPosterName, board.defaultIdFormat,
      JSON.stringify(board.defaultThreadAcl), JSON.stringify(board.defaultPostAcl), JSON.stringify(board.ngWords),
      board.category, board.icon, board.colorTheme, board.createdAt,
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
  if (f.ngWords !== undefined)                  { fields.push('ng_words = ?');                     values.push(JSON.stringify(f.ngWords)) }
  if (f.category !== undefined)                 { fields.push('category = ?');                     values.push(f.category) }
  if (f.icon !== undefined)                     { fields.push('icon = ?');                         values.push(f.icon) }
  if (f.colorTheme !== undefined)                { fields.push('color_theme = ?');                  values.push(f.colorTheme) }

  if (fields.length === 0) return true
  values.push(id)
  const result = await db.run(`UPDATE boards SET ${fields.join(', ')} WHERE id = ?`, values)
  return result.changes > 0
}

export async function deleteBoard(db: DbAdapter, id: string): Promise<boolean> {
  const result = await db.run('DELETE FROM boards WHERE id = ?', [id])
  return result.changes > 0
}
