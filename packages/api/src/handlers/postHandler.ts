import type { Context } from 'hono'
import type { AppEnv } from '../types'
import * as postService from '../services/postService'
import * as reportService from '../services/reportService'
import { isZodError, zodMessage } from '../utils/zodHelper'
import { parsePaginationQuery } from '../utils/pagination'
import { adminVisible, stripPost } from './responseShaping'

// c.req.param(...) を string (非optional) として型付けするため、Contextにpathを明示する
type WithThreadId = Context<AppEnv, '/:boardId/:threadId', any>
type WithPostNumber = Context<AppEnv, '/:boardId/:threadId/:postNumber', any>

// GET /boards/:boardId/threads/:threadId/posts (limit/cursorページネーション)
export async function getPostsHandler(c: WithThreadId) {
  const boardId = c.req.param('boardId')
  const threadId = c.req.param('threadId')
  const pagination = parsePaginationQuery(c.req.query())
  const page = await postService.getPosts(
    c.get('db'), boardId, threadId, c.get('userId'), c.get('userRoleIds'), c.get('isSysAdmin'), pagination,
  )
  if (!page) return c.json({ error: 'THREAD_NOT_FOUND', message: 'Thread not found' }, 404)
  const visible = adminVisible(c)
  return c.json({ data: page.items.map(p => stripPost(p, visible)), nextCursor: page.nextCursor })
}

// GET /boards/:boardId/threads/:threadId/posts/:postNumber - 特定の投稿を取得
export async function getPostHandler(c: WithPostNumber) {
  const boardId = c.req.param('boardId')
  const threadId = c.req.param('threadId')
  const postNumber = parseInt(c.req.param('postNumber'), 10)
  if (isNaN(postNumber) || postNumber < 1) {
    return c.json({ error: 'VALIDATION_ERROR', message: 'postNumber must be a positive integer' }, 400)
  }
  const post = await postService.getPostByNumber(
    c.get('db'), boardId, threadId, postNumber,
    c.get('userId'), c.get('userRoleIds'), c.get('isSysAdmin'),
  )
  if (!post) return c.json({ error: 'POST_NOT_FOUND', message: 'Post not found' }, 404)
  return c.json({ data: stripPost(post, adminVisible(c)) })
}

// POST /boards/:boardId/threads/:threadId/posts - 投稿作成
export async function createPostHandler(c: WithThreadId) {
  const boardId = c.req.param('boardId')
  const threadId = c.req.param('threadId')
  try {
    const body = await c.req.json()
    const input = postService.parseCreatePost(body)
    const post = await postService.createPost(
      c.get('db'), boardId, threadId, input,
      c.get('userId'), c.get('userRoleIds'), c.get('isSysAdmin'),
      c.get('sessionId'), c.get('turnstileSessionId'),
    )
    return c.json({ data: stripPost(post, adminVisible(c)) }, 201)
  } catch (e) {
    if (isZodError(e)) return c.json({ error: 'VALIDATION_ERROR', message: zodMessage(e) }, 400)
    if (e instanceof Error) {
      if (e.message === 'THREAD_NOT_FOUND') return c.json({ error: 'THREAD_NOT_FOUND', message: 'Thread not found' }, 404)
      if (e.message === 'THREAD_ARCHIVED') return c.json({ error: 'THREAD_ARCHIVED', message: 'This thread is archived (dat-ochi)' }, 409)
      if (e.message === 'FORBIDDEN') return c.json({ error: 'FORBIDDEN', message: 'Insufficient permissions' }, 403)
      if (e.message === 'POST_LIMIT_REACHED') return c.json({ error: 'POST_LIMIT_REACHED', message: 'Post limit reached' }, 422)
      if (e.message === 'CONTENT_TOO_LONG') return c.json({ error: 'CONTENT_TOO_LONG', message: 'Content is too long' }, 422)
      if (e.message === 'CONTENT_TOO_MANY_LINES') return c.json({ error: 'CONTENT_TOO_MANY_LINES', message: 'Content has too many lines' }, 422)
      if (e.message === 'POSTER_NAME_TOO_LONG') return c.json({ error: 'POSTER_NAME_TOO_LONG', message: 'Poster name is too long' }, 422)
      if (e.message === 'POSTER_OPTION_TOO_LONG') return c.json({ error: 'POSTER_OPTION_TOO_LONG', message: 'Poster option info is too long' }, 422)
      if (e.message === 'CONTENT_REJECTED') return c.json({ error: 'CONTENT_REJECTED', message: 'Content was rejected' }, 400)
      if (e.message === 'DUPLICATE_CONTENT') return c.json({ error: 'DUPLICATE_CONTENT', message: 'Duplicate content' }, 409)
    }
    throw e
  }
}

// PUT /boards/:boardId/threads/:threadId/posts/:postNumber - 投稿内容の冪等な置換 + isEdited フラグ
export async function putPostHandler(c: WithPostNumber) {
  const boardId = c.req.param('boardId')
  const threadId = c.req.param('threadId')
  const postNumber = parseInt(c.req.param('postNumber'), 10)
  if (isNaN(postNumber) || postNumber < 1) {
    return c.json({ error: 'VALIDATION_ERROR', message: 'postNumber must be a positive integer' }, 400)
  }
  try {
    const body = await c.req.json()
    const input = postService.parseUpdatePost(body)
    const post = await postService.updatePost(
      c.get('db'), boardId, threadId, postNumber, input,
      c.get('userId'), c.get('userRoleIds'), c.get('isSysAdmin'),
    )
    if (!post) return c.json({ error: 'POST_NOT_FOUND', message: 'Post not found' }, 404)
    return c.json({ data: stripPost(post, adminVisible(c)) })
  } catch (e) {
    if (isZodError(e)) return c.json({ error: 'VALIDATION_ERROR', message: zodMessage(e) }, 400)
    if (e instanceof Error) {
      if (e.message === 'FORBIDDEN') return c.json({ error: 'FORBIDDEN', message: 'Insufficient permissions' }, 403)
      if (e.message === 'BOARD_NOT_FOUND') return c.json({ error: 'BOARD_NOT_FOUND', message: 'Board not found' }, 404)
      if (e.message === 'CONTENT_TOO_LONG') return c.json({ error: 'CONTENT_TOO_LONG', message: 'Content is too long' }, 422)
      if (e.message === 'CONTENT_TOO_MANY_LINES') return c.json({ error: 'CONTENT_TOO_MANY_LINES', message: 'Content has too many lines' }, 422)
      if (e.message === 'POSTER_NAME_TOO_LONG') return c.json({ error: 'POSTER_NAME_TOO_LONG', message: 'Poster name is too long' }, 422)
      if (e.message === 'POSTER_OPTION_TOO_LONG') return c.json({ error: 'POSTER_OPTION_TOO_LONG', message: 'Poster option info is too long' }, 422)
      if (e.message === 'CONTENT_REJECTED') return c.json({ error: 'CONTENT_REJECTED', message: 'Content was rejected' }, 400)
    }
    throw e
  }
}

// PATCH /boards/:boardId/threads/:threadId/posts/:postNumber - 投稿メタデータ(acl)更新
export async function patchPostHandler(c: WithPostNumber) {
  const boardId = c.req.param('boardId')
  const threadId = c.req.param('threadId')
  const postNumber = parseInt(c.req.param('postNumber'), 10)
  if (isNaN(postNumber) || postNumber < 1) {
    return c.json({ error: 'VALIDATION_ERROR', message: 'postNumber must be a positive integer' }, 400)
  }
  try {
    const body = await c.req.json()
    const input = postService.parsePatchPost(body)
    const post = await postService.patchPost(
      c.get('db'), boardId, threadId, postNumber, input,
      c.get('userId'), c.get('userRoleIds'), c.get('isSysAdmin'),
    )
    if (!post) return c.json({ error: 'POST_NOT_FOUND', message: 'Post not found' }, 404)
    return c.json({ data: stripPost(post, adminVisible(c)) })
  } catch (e) {
    if (isZodError(e)) return c.json({ error: 'VALIDATION_ERROR', message: zodMessage(e) }, 400)
    if (e instanceof Error && e.message === 'FORBIDDEN') {
      return c.json({ error: 'FORBIDDEN', message: 'Insufficient permissions' }, 403)
    }
    throw e
  }
}

// DELETE /boards/:boardId/threads/:threadId/posts/:postNumber - 投稿ソフト削除。常に204 (ボディ無し)
export async function deletePostHandler(c: WithPostNumber) {
  const boardId = c.req.param('boardId')
  const threadId = c.req.param('threadId')
  const postNumber = parseInt(c.req.param('postNumber'), 10)
  if (isNaN(postNumber) || postNumber < 1) {
    return c.json({ error: 'VALIDATION_ERROR', message: 'postNumber must be a positive integer' }, 400)
  }
  try {
    const deleted = await postService.deletePost(
      c.get('db'), boardId, threadId, postNumber,
      c.get('userId'), c.get('userRoleIds'), c.get('isSysAdmin'),
    )
    if (!deleted) return c.json({ error: 'POST_NOT_FOUND', message: 'Post not found' }, 404)
    return new Response(null, { status: 204 })
  } catch (e) {
    if (e instanceof Error && e.message === 'FORBIDDEN') {
      return c.json({ error: 'FORBIDDEN', message: 'Insufficient permissions' }, 403)
    }
    throw e
  }
}

// POST /boards/:boardId/threads/:threadId/posts/:postNumber/report - レスを通報 (誰でも可)
export async function reportPostHandler(c: WithPostNumber) {
  const boardId = c.req.param('boardId')
  const threadId = c.req.param('threadId')
  const postNumber = parseInt(c.req.param('postNumber'), 10)
  if (isNaN(postNumber) || postNumber < 1) {
    return c.json({ error: 'VALIDATION_ERROR', message: 'postNumber must be a positive integer' }, 400)
  }
  try {
    await reportService.reportPost(c.get('db'), boardId, threadId, postNumber, c.get('turnstileSessionId'))
    return c.json({ data: { message: 'Post reported' } }, 201)
  } catch (e) {
    if (e instanceof Error) {
      if (e.message === 'THREAD_NOT_FOUND') return c.json({ error: 'THREAD_NOT_FOUND', message: 'Thread not found' }, 404)
      if (e.message === 'POST_NOT_FOUND') return c.json({ error: 'POST_NOT_FOUND', message: 'Post not found' }, 404)
    }
    throw e
  }
}
