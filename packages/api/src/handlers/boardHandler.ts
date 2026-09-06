import type { Context } from 'hono'
import { isZodError, zodMessage } from '../utils/zodHelper'
import type { AppEnv } from '../types'
import * as boardService from '../services/boardService'
import { parsePaginationQuery } from '../utils/pagination'
import { adminVisible, stripBoard } from './responseShaping'

// c.req.param('boardId') を string (非optional) として型付けするため、Contextにpathを明示する。
// Input を any にしているのは、zValidator が付与する入力スキーマ (query/json) を
// ハンドラ側の型注釈で上書き・消失させないため。
type BoardContext = Context<AppEnv, '/:boardId', any>
type RootContext = Context<AppEnv, string, any>

// GET /boards (limit/cursorページネーション)
export async function getBoardsHandler(c: RootContext) {
  const pagination = parsePaginationQuery(c.req.query())
  const page = await boardService.getBoards(c.get('db'), c.get('userId'), c.get('userRoleIds'), c.get('isSysAdmin'), pagination)
  const visible = adminVisible(c)
  return c.json({ data: page.items.map(b => stripBoard(b, visible)), nextCursor: page.nextCursor })
}

// GET /boards/:boardId
export async function getBoardHandler(c: BoardContext) {
  const boardId = c.req.param('boardId')
  const board = await boardService.getBoard(c.get('db'), boardId, c.get('userId'), c.get('userRoleIds'), c.get('isSysAdmin'))
  if (!board) return c.json({ error: 'BOARD_NOT_FOUND', message: 'Board not found' }, 404)
  return c.json({ data: stripBoard(board, adminVisible(c)) })
}

// POST /boards (sys admin のみ)
export async function createBoardHandler(c: RootContext) {
  try {
    const body = await c.req.json()
    const input = boardService.parseBoardBody(body)
    const board = await boardService.createBoard(
      c.get('db'), input, c.get('userId'), c.get('isSysAdmin'),
      c.get('sessionId'), c.get('turnstileSessionId'),
    )
    return c.json({ data: stripBoard(board, adminVisible(c)) }, 201)
  } catch (e) {
    if (isZodError(e)) return c.json({ error: 'VALIDATION_ERROR', message: zodMessage(e) }, 400)
    if (e instanceof Error && e.message === 'FORBIDDEN') {
      return c.json({ error: 'FORBIDDEN', message: 'Insufficient permissions' }, 403)
    }
    throw e
  }
}

// PUT /boards/:boardId: upsert (存在しなければ sys admin のみ作成、存在すれば全フィールド置換)
export async function putBoardHandler(c: BoardContext) {
  const boardId = c.req.param('boardId')
  try {
    const body = await c.req.json()
    const input = boardService.parseBoardBody(body)
    const board = await boardService.putBoard(
      c.get('db'), boardId, input,
      c.get('userId'), c.get('userRoleIds'), c.get('isSysAdmin'),
      c.get('sessionId'), c.get('turnstileSessionId'),
    )
    return c.json({ data: stripBoard(board, adminVisible(c)) })
  } catch (e) {
    if (isZodError(e)) return c.json({ error: 'VALIDATION_ERROR', message: zodMessage(e) }, 400)
    if (e instanceof Error) {
      if (e.message === 'FORBIDDEN') return c.json({ error: 'FORBIDDEN', message: 'Insufficient permissions' }, 403)
      if (e.message === 'BOARD_NOT_FOUND') return c.json({ error: 'BOARD_NOT_FOUND', message: 'Board not found' }, 404)
    }
    throw e
  }
}

// PATCH /boards/:boardId: 既存の板の指定フィールドのみ更新
export async function patchBoardHandler(c: BoardContext) {
  const boardId = c.req.param('boardId')
  try {
    const body = await c.req.json()
    const input = boardService.parsePatchBoard(body)
    const board = await boardService.patchBoard(
      c.get('db'), boardId, input,
      c.get('userId'), c.get('userRoleIds'), c.get('isSysAdmin'),
    )
    if (!board) return c.json({ error: 'BOARD_NOT_FOUND', message: 'Board not found' }, 404)
    return c.json({ data: stripBoard(board, adminVisible(c)) })
  } catch (e) {
    if (isZodError(e)) return c.json({ error: 'VALIDATION_ERROR', message: zodMessage(e) }, 400)
    if (e instanceof Error && e.message === 'FORBIDDEN') {
      return c.json({ error: 'FORBIDDEN', message: 'Insufficient permissions' }, 403)
    }
    throw e
  }
}

// DELETE /boards/:boardId
export async function deleteBoardHandler(c: BoardContext) {
  const boardId = c.req.param('boardId')
  try {
    const deleted = await boardService.deleteBoard(
      c.get('db'), boardId,
      c.get('userId'), c.get('userRoleIds'), c.get('isSysAdmin'),
    )
    if (!deleted) return c.json({ error: 'BOARD_NOT_FOUND', message: 'Board not found' }, 404)
    return new Response(null, { status: 204 })
  } catch (e) {
    if (e instanceof Error && e.message === 'FORBIDDEN') {
      return c.json({ error: 'FORBIDDEN', message: 'Insufficient permissions' }, 403)
    }
    throw e
  }
}
