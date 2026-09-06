import type { Context } from 'hono'
import { isZodError, zodMessage } from '../utils/zodHelper'
import type { AppEnv } from '../types'
import * as threadService from '../services/threadService'
import type { PostRange } from '../services/threadService'
import { parsePostRanges } from '../utils/postRange'
import { adminVisible, stripThread, stripPost } from './responseShaping'

// GET /boards/:boardId - 板情報 + スレッド一覧
export async function getThreadsHandler(c: Context<AppEnv>): Promise<Response> {
  const boardId = c.req.param('boardId')
  const result = await threadService.getThreadsWithBoard(
    c.get('db'), boardId, c.get('userId'), c.get('userRoleIds'), c.get('isSysAdmin'),
  )
  if (!result) return c.json({ error: 'BOARD_NOT_FOUND', message: 'Board not found' }, 404)
  const visible = adminVisible(c)
  return c.json({
    data: {
      board: result.board,
      threads: result.threads.map(t => stripThread(t, visible)),
    },
  })
}

// GET /boards/:boardId/:threadId - スレッド情報 + 投稿一覧
// ?posts= でレンジ指定が可能 (省略時は全件)
//   単一:      ?posts=5       → 5番のみ
//   以降:      ?posts=10-     → 10番以降
//   以前:      ?posts=-20     → 1〜20番
//   範囲:      ?posts=10-20   → 10〜20番
//   複数:      ?posts=1-5,10,20-  → 複数レンジをカンマ区切り
export async function getThreadWithPostsHandler(c: Context<AppEnv>): Promise<Response> {
  const boardId = c.req.param('boardId')
  const threadId = c.req.param('threadId')
  const postsParam = c.req.query('posts')
  let ranges: PostRange[] | undefined
  if (postsParam != null) {
    const parsed = parsePostRanges(postsParam)
    if (!parsed) {
      return c.json({ error: 'VALIDATION_ERROR', message: 'Invalid posts range. Use formats: N, N-, N-M, -N or comma-separated combinations' }, 400)
    }
    ranges = parsed
  }
  const result = await threadService.getThreadWithPosts(
    c.get('db'), boardId, threadId, c.get('userId'), c.get('userRoleIds'), c.get('isSysAdmin'),
    ranges,
  )
  if (!result) return c.json({ error: 'THREAD_NOT_FOUND', message: 'Thread not found' }, 404)
  const visible = adminVisible(c)
  return c.json({
    data: {
      thread: stripThread(result.thread, visible),
      posts: result.posts.map(p => stripPost(p, visible)),
    },
  })
}

// POST /boards/:boardId - スレッド作成 (第1レス同時作成)
export async function createThreadHandler(c: Context<AppEnv>): Promise<Response> {
  const boardId = c.req.param('boardId')
  try {
    const body = await c.req.json()
    const input = threadService.parseCreateThread(body)
    const result = await threadService.createThread(
      c.get('db'), boardId, input,
      c.get('userId'), c.get('userRoleIds'), c.get('isSysAdmin'),
      c.req.header('X-Session-Id') ?? null,
      c.req.header('X-Turnstile-Session') ?? null,
    )
    const visible = adminVisible(c)
    return c.json({
      data: {
        thread: stripThread(result.thread, visible),
        firstPost: stripPost(result.firstPost, visible),
      },
    }, 201)
  } catch (e) {
    if (isZodError(e)) {
      return c.json({ error: 'VALIDATION_ERROR', message: zodMessage(e) }, 400)
    }
    if (e instanceof Error) {
      if (e.message === 'BOARD_NOT_FOUND') return c.json({ error: 'BOARD_NOT_FOUND', message: 'Board not found' }, 404)
      if (e.message === 'FORBIDDEN') return c.json({ error: 'FORBIDDEN', message: 'Insufficient permissions' }, 403)
      if (e.message === 'THREAD_LIMIT_REACHED') return c.json({ error: 'THREAD_LIMIT_REACHED', message: 'Thread limit reached' }, 422)
      if (e.message === 'TITLE_TOO_LONG') return c.json({ error: 'TITLE_TOO_LONG', message: 'Thread title is too long' }, 422)
      if (e.message === 'CONTENT_TOO_LONG') return c.json({ error: 'CONTENT_TOO_LONG', message: 'Content is too long' }, 422)
      if (e.message === 'CONTENT_TOO_MANY_LINES') return c.json({ error: 'CONTENT_TOO_MANY_LINES', message: 'Content has too many lines' }, 422)
    }
    throw e
  }
}

// PUT /boards/:boardId/:threadId - title/posterName 更新 + isEdited フラグ
export async function putThreadHandler(c: Context<AppEnv>): Promise<Response> {
  const boardId = c.req.param('boardId')
  const threadId = c.req.param('threadId')
  try {
    const body = await c.req.json()
    const input = threadService.parsePutThread(body)
    const thread = await threadService.putThread(
      c.get('db'), boardId, threadId, input,
      c.get('userId'), c.get('userRoleIds'), c.get('isSysAdmin'),
    )
    if (!thread) return c.json({ error: 'THREAD_NOT_FOUND', message: 'Thread not found' }, 404)
    return c.json({ data: stripThread(thread, adminVisible(c)) })
  } catch (e) {
    if (isZodError(e)) return c.json({ error: 'VALIDATION_ERROR', message: zodMessage(e) }, 400)
    if (e instanceof Error && e.message === 'FORBIDDEN') {
      return c.json({ error: 'FORBIDDEN', message: 'Insufficient permissions' }, 403)
    }
    throw e
  }
}

// PATCH /boards/:boardId/:threadId - メタデータ全般更新 (upsert)
export async function patchThreadHandler(c: Context<AppEnv>): Promise<Response> {
  const boardId = c.req.param('boardId')
  const threadId = c.req.param('threadId')
  try {
    const body = await c.req.json()
    const input = threadService.parsePatchThread(body)
    const thread = await threadService.patchThread(
      c.get('db'), boardId, threadId, input,
      c.get('userId'), c.get('userRoleIds'), c.get('isSysAdmin'),
      c.req.header('X-Session-Id') ?? null,
      c.req.header('X-Turnstile-Session') ?? null,
    )
    return c.json({ data: stripThread(thread, adminVisible(c)) })
  } catch (e) {
    if (isZodError(e)) return c.json({ error: 'VALIDATION_ERROR', message: zodMessage(e) }, 400)
    if (e instanceof Error) {
      if (e.message === 'FORBIDDEN') return c.json({ error: 'FORBIDDEN', message: 'Insufficient permissions' }, 403)
      if (e.message === 'BOARD_NOT_FOUND') return c.json({ error: 'BOARD_NOT_FOUND', message: 'Board not found' }, 404)
    }
    throw e
  }
}

// DELETE /boards/:boardId/:threadId - スレッド削除
export async function deleteThreadHandler(c: Context<AppEnv>): Promise<Response> {
  const boardId = c.req.param('boardId')
  const threadId = c.req.param('threadId')
  try {
    const deleted = await threadService.deleteThread(
      c.get('db'), boardId, threadId,
      c.get('userId'), c.get('userRoleIds'), c.get('isSysAdmin'),
    )
    if (!deleted) return c.json({ error: 'THREAD_NOT_FOUND', message: 'Thread not found' }, 404)
    return new Response(null, { status: 204 })
  } catch (e) {
    if (e instanceof Error && e.message === 'FORBIDDEN') {
      return c.json({ error: 'FORBIDDEN', message: 'Insufficient permissions' }, 403)
    }
    throw e
  }
}
