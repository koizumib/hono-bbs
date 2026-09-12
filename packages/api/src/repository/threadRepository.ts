import type { Thread, Post, ResourceAcl } from '../types'
import type { DbAdapter } from '../adapters/db'
import { defaultAcl } from '../utils/acl'

type ThreadRow = {
  id: string
  board_id: string
  acl: string
  title: string
  max_posts: number
  max_post_length: number
  max_post_lines: number
  max_poster_name_length: number
  max_poster_option_length: number
  poster_name: string
  id_format: string
  post_count: number
  is_edited: number
  edited_at: string | null
  is_archived: number
  archived_at: string | null
  created_at: string
  updated_at: string
  creator_user_id: string | null
  creator_session_id: string | null
  creator_turnstile_session_id: string | null
}

// 第1レスのカラムをエイリアスで結合する際の拡張型
type ThreadWithFirstPostRow = ThreadRow & {
  p_id: string | null
  p_post_number: number | null
  p_acl: string | null
  p_author_id: string | null
  p_poster_name: string | null
  p_poster_option_info: string | null
  p_content: string | null
  p_is_deleted: number | null
  p_is_edited: number | null
  p_edited_at: string | null
  p_created_at: string | null
  p_creator_user_id: string | null
  p_creator_session_id: string | null
  p_creator_turnstile_session_id: string | null
}

function rowToThread(row: ThreadRow): Thread {
  return {
    id: row.id,
    boardId: row.board_id,
    acl: JSON.parse(row.acl) as ResourceAcl,
    title: row.title,
    maxPosts: row.max_posts,
    maxPostLength: row.max_post_length,
    maxPostLines: row.max_post_lines,
    maxPosterNameLength: row.max_poster_name_length,
    maxPosterOptionLength: row.max_poster_option_length,
    posterName: row.poster_name,
    idFormat: row.id_format,
    postCount: row.post_count,
    isEdited: row.is_edited === 1,
    editedAt: row.edited_at,
    isArchived: row.is_archived === 1,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    adminMeta: {
      creatorUserId: row.creator_user_id,
      creatorSessionId: row.creator_session_id,
      creatorTurnstileSessionId: row.creator_turnstile_session_id,
    },
  }
}

function rowToFirstPost(row: ThreadWithFirstPostRow): Post | null {
  if (!row.p_id) return null
  return {
    id: row.p_id,
    threadId: row.id,
    postNumber: row.p_post_number!,
    acl: row.p_acl ? (JSON.parse(row.p_acl) as ResourceAcl) : defaultAcl(),
    authorId: row.p_author_id ?? '',
    posterName: row.p_poster_name ?? '',
    posterOptionInfo: row.p_poster_option_info ?? '',
    content: row.p_content ?? '',
    isDeleted: row.p_is_deleted === 1,
    isEdited: row.p_is_edited === 1,
    editedAt: row.p_edited_at ?? null,
    createdAt: row.p_created_at ?? '',
    adminMeta: {
      creatorUserId: row.p_creator_user_id ?? null,
      creatorSessionId: row.p_creator_session_id ?? null,
      creatorTurnstileSessionId: row.p_creator_turnstile_session_id ?? null,
    },
  }
}

export type ThreadCursor = { updatedAt: string; id: string }

// limit/cursorページネーション。updated_at DESC, id DESC の複合キーでキーセットページングする。
// includeArchived=false (デフォルト) の場合、dat落ち済み(is_archived=1)のスレッドは除外する。
// ただし archivedTtlSeconds > 0 なら、dat落ちしてからその秒数が経つまでは猶予期間として
// 一覧に残す (ARCHIVED_THREAD_VISIBLE_SECONDS)。0 = 無制限 (時間によるフィルタをしない)。
export async function findThreadsByBoardIdPage(
  db: DbAdapter,
  boardId: string,
  opts: {
    limit: number
    cursor: ThreadCursor | null
    includeArchived: boolean
    archivedTtlSeconds: number
  },
): Promise<{ items: Thread[]; nextCursorRaw: ThreadCursor | null }> {
  const params: unknown[] = [boardId]
  let cursorClause = ''
  if (opts.cursor) {
    cursorClause = ' AND (t.updated_at < ? OR (t.updated_at = ? AND t.id < ?))'
    params.push(opts.cursor.updatedAt, opts.cursor.updatedAt, opts.cursor.id)
  }
  let archivedClause = ''
  if (!opts.includeArchived && opts.archivedTtlSeconds > 0) {
    const cutoff = new Date(Date.now() - opts.archivedTtlSeconds * 1000).toISOString()
    archivedClause = ' AND (t.is_archived = 0 OR t.archived_at > ?)'
    params.push(cutoff)
  }
  params.push(opts.limit + 1)

  const result = await db.all<ThreadWithFirstPostRow>(
    `SELECT
      t.*,
      p.id AS p_id,
      p.post_number AS p_post_number,
      p.acl AS p_acl,
      p.author_id AS p_author_id,
      p.poster_name AS p_poster_name,
      p.poster_option_info AS p_poster_option_info,
      p.content AS p_content,
      p.is_deleted AS p_is_deleted,
      p.is_edited AS p_is_edited,
      p.edited_at AS p_edited_at,
      p.created_at AS p_created_at,
      p.creator_user_id AS p_creator_user_id,
      p.creator_session_id AS p_creator_session_id,
      p.creator_turnstile_session_id AS p_creator_turnstile_session_id
    FROM threads t
    LEFT JOIN posts p ON p.thread_id = t.id AND p.post_number = 1
    WHERE t.board_id = ?${cursorClause}${archivedClause}
    ORDER BY t.updated_at DESC, t.id DESC LIMIT ?`,
    params,
  )
  const hasMore = result.results.length > opts.limit
  const pageRows = hasMore ? result.results.slice(0, opts.limit) : result.results
  const last = pageRows[pageRows.length - 1]
  return {
    items: pageRows.map(row => ({ ...rowToThread(row), firstPost: rowToFirstPost(row) })),
    nextCursorRaw: hasMore && last ? { updatedAt: last.updated_at, id: last.id } : null,
  }
}

export async function findThreadById(db: DbAdapter, id: string): Promise<Thread | null> {
  const row = await db.first<ThreadRow>('SELECT * FROM threads WHERE id = ?', [id])
  return row ? rowToThread(row) : null
}

export async function insertThread(db: DbAdapter, thread: Thread): Promise<void> {
  await db.run(
    `INSERT INTO threads (
      id, board_id, acl, title,
      max_posts, max_post_length, max_post_lines,
      max_poster_name_length, max_poster_option_length,
      poster_name, id_format, post_count, is_edited, edited_at,
      created_at, updated_at, creator_user_id, creator_session_id, creator_turnstile_session_id
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      thread.id, thread.boardId, JSON.stringify(thread.acl),
      thread.title,
      thread.maxPosts, thread.maxPostLength, thread.maxPostLines,
      thread.maxPosterNameLength, thread.maxPosterOptionLength,
      thread.posterName, thread.idFormat, thread.postCount,
      thread.isEdited ? 1 : 0, thread.editedAt,
      thread.createdAt, thread.updatedAt,
      thread.adminMeta.creatorUserId, thread.adminMeta.creatorSessionId, thread.adminMeta.creatorTurnstileSessionId,
    ],
  )
}

export async function incrementPostCount(db: DbAdapter, threadId: string, updatedAt: string): Promise<void> {
  await db.run(
    'UPDATE threads SET post_count = post_count + 1, updated_at = ? WHERE id = ?',
    [updatedAt, threadId],
  )
}

// dat落ち(過去ログ化)フラグの設定/解除専用。updateThread()とは違い updated_at は更新しない
// (アーカイブ操作自体でスレの「上がった」順序=updated_atを壊さないため)
export async function setThreadArchived(db: DbAdapter, threadId: string, isArchived: boolean): Promise<void> {
  const archivedAt = isArchived ? new Date().toISOString() : null
  await db.run(
    'UPDATE threads SET is_archived = ?, archived_at = ? WHERE id = ?',
    [isArchived ? 1 : 0, archivedAt, threadId],
  )
}

// 板のスレ数上限チェック用。dat落ち済みは数えない
export async function countActiveThreadsByBoardId(db: DbAdapter, boardId: string): Promise<number> {
  const row = await db.first<{ cnt: number }>(
    'SELECT COUNT(*) AS cnt FROM threads WHERE board_id = ? AND is_archived = 0',
    [boardId],
  )
  return row?.cnt ?? 0
}

// 板のスレ数上限による押し出し(dat落ち)用。最も最後にレスが付いていないアクティブなスレを探す
export async function findOldestActiveThreadId(db: DbAdapter, boardId: string): Promise<string | null> {
  const row = await db.first<{ id: string }>(
    'SELECT id FROM threads WHERE board_id = ? AND is_archived = 0 ORDER BY updated_at ASC LIMIT 1',
    [boardId],
  )
  return row?.id ?? null
}

export type ThreadUpdateFields = {
  title?: string
  posterName?: string
  acl?: ResourceAcl
  maxPosts?: number
  maxPostLength?: number
  maxPostLines?: number
  maxPosterNameLength?: number
  maxPosterOptionLength?: number
  idFormat?: string
  isEdited?: boolean
  editedAt?: string | null
}

export async function updateThread(
  db: DbAdapter,
  id: string,
  updates: ThreadUpdateFields,
): Promise<boolean> {
  const fields: string[] = []
  const values: unknown[] = []

  if (updates.title !== undefined)              { fields.push('title = ?');                values.push(updates.title) }
  if (updates.posterName !== undefined)         { fields.push('poster_name = ?');          values.push(updates.posterName) }
  if (updates.acl !== undefined)                { fields.push('acl = ?');                  values.push(JSON.stringify(updates.acl)) }
  if (updates.maxPosts !== undefined)           { fields.push('max_posts = ?');            values.push(updates.maxPosts) }
  if (updates.maxPostLength !== undefined)      { fields.push('max_post_length = ?');      values.push(updates.maxPostLength) }
  if (updates.maxPostLines !== undefined)       { fields.push('max_post_lines = ?');       values.push(updates.maxPostLines) }
  if (updates.maxPosterNameLength !== undefined){ fields.push('max_poster_name_length = ?'); values.push(updates.maxPosterNameLength) }
  if (updates.maxPosterOptionLength !== undefined) { fields.push('max_poster_option_length = ?'); values.push(updates.maxPosterOptionLength) }
  if (updates.idFormat !== undefined)           { fields.push('id_format = ?');            values.push(updates.idFormat) }
  if (updates.isEdited !== undefined)           { fields.push('is_edited = ?');            values.push(updates.isEdited ? 1 : 0) }
  if ('editedAt' in updates)                    { fields.push('edited_at = ?');            values.push(updates.editedAt ?? null) }

  if (fields.length === 0) return true
  fields.push('updated_at = ?')
  values.push(new Date().toISOString())
  values.push(id)
  const result = await db.run(`UPDATE threads SET ${fields.join(', ')} WHERE id = ?`, values)
  return result.changes > 0
}

export async function deleteThread(db: DbAdapter, id: string): Promise<boolean> {
  const result = await db.run('DELETE FROM threads WHERE id = ?', [id])
  return result.changes > 0
}

export type PopularCandidateRow = {
  thread_id: string
  board_id: string
  title: string
  post_count: number
  created_at: string
  thread_acl: string
  board_name: string
  board_acl: string
  op_author_id: string | null
  op_content: string | null
  op_is_deleted: number | null
  op_poster_name: string | null
  op_poster_option_info: string | null
}

// ホーム画面向け「全板横断の人気スレッド」集計の候補一覧。dat落ち済みは今後勢いが伸びることが
// ないため除外する。post_countは非正規化済みで、posts側もidx_posts_thread_post_numberで
// 引けるため重いクエリではないが、全スレッドを一度に読むので都度のAPIリクエストからは呼ばず、
// Cron(1時間毎)からのみ呼ぶ想定。1レス目(OP)のID・本文をプレビュー/OP表示用に一緒に取る。
export async function findActiveThreadsForRanking(db: DbAdapter): Promise<PopularCandidateRow[]> {
  const result = await db.all<PopularCandidateRow>(
    `SELECT t.id AS thread_id, t.board_id AS board_id, t.title AS title,
            t.post_count AS post_count, t.created_at AS created_at, t.acl AS thread_acl,
            b.name AS board_name, b.acl AS board_acl,
            p.author_id AS op_author_id, p.content AS op_content, p.is_deleted AS op_is_deleted,
            p.poster_name AS op_poster_name, p.poster_option_info AS op_poster_option_info
     FROM threads t
     JOIN boards b ON b.id = t.board_id
     LEFT JOIN posts p ON p.thread_id = t.id AND p.post_number = 1
     WHERE t.is_archived = 0`,
  )
  return result.results
}
