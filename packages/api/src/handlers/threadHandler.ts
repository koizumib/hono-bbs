import type { Context } from 'hono'
import { isZodError, zodMessage } from '../utils/zodHelper'
import type { AppEnv } from '../types'
import * as threadService from '../services/threadService'
import { parsePaginationQuery } from '../utils/pagination'
import { adminVisible, stripThread, stripPost } from './responseShaping'

// c.req.param(...) を string (非optional) として型付けするため、Contextにpathを明示する
type WithBoardId = Context<AppEnv, '/:boardId', any>
type WithThreadId = Context<AppEnv, '/:boardId/:threadId', any>

// GET /boards/:boardId/threads (limit/cursorページネーション)
export async function getThreadsHandler(c: WithBoardId) {
  const boardId = c.req.param('boardId')
  const pagination = parsePaginationQuery(c.req.query())
  const page = await threadService.getThreads(
    c.get('db'), boardId, c.get('userId'), c.get('userRoleIds'), c.get('isSysAdmin'), pagination,
  )
  if (!page) return c.json({ error: 'BOARD_NOT_FOUND', message: 'Board not found' }, 404)
  const visible = adminVisible(c)
  return c.json({ data: page.items.map(t => stripThread(t, visible)), nextCursor: page.nextCursor })
}

// GET /boards/:boardId/threads/:threadId
export async function getThreadHandler(c: WithThreadId) {
  const boardId = c.req.param('boardId')
  const threadId = c.req.param('threadId')
  const thread = await threadService.getThread(
    c.get('db'), boardId, threadId, c.get('userId'), c.get('userRoleIds'), c.get('isSysAdmin'),
  )
  if (!thread) return c.json({ error: 'THREAD_NOT_FOUND', message: 'Thread not found' }, 404)
  return c.json({ data: stripThread(thread, adminVisible(c)) })
}

// POST /boards/:boardId/threads - スレッド作成 (第1レス同時作成)
export async function createThreadHandler(c: WithBoardId) {
  const boardId = c.req.param('boardId')
  try {
    const body = await c.req.json()
    const input = threadService.parseCreateThread(body)
    const result = await threadService.createThread(
      c.get('db'), boardId, input,
      c.get('userId'), c.get('userRoleIds'), c.get('isSysAdmin'),
      c.get('sessionId'), c.get('turnstileSessionId'),
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

// PUT /boards/:boardId/threads/:threadId: upsert (存在しなければ sys admin のみ作成、存在すれば全フィールド置換)
export async function putThreadHandler(c: WithThreadId) {
  const boardId = c.req.param('boardId')
  const threadId = c.req.param('threadId')
  try {
    const body = await c.req.json()
    const input = threadService.parsePutThread(body)
    const thread = await threadService.putThread(
      c.get('db'), boardId, threadId, input,
      c.get('userId'), c.get('userRoleIds'), c.get('isSysAdmin'),
      c.get('sessionId'), c.get('turnstileSessionId'),
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

// PATCH /boards/:boardId/threads/:threadId: 既存スレッドの指定フィールドのみ更新
export async function patchThreadHandler(c: WithThreadId) {
  const boardId = c.req.param('boardId')
  const threadId = c.req.param('threadId')
  try {
    const body = await c.req.json()
    const input = threadService.parsePatchThread(body)
    const thread = await threadService.patchThread(
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

// DELETE /boards/:boardId/threads/:threadId
export async function deleteThreadHandler(c: WithThreadId) {
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
