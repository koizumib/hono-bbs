import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import type { AppEnv } from '../types'
import {
  getBoardsHandler,
  getBoardHandler,
  createBoardHandler,
  putBoardHandler,
  patchBoardHandler,
  deleteBoardHandler,
} from '../handlers/boardHandler'
import { boardBodySchema, patchBoardSchema } from '../services/boardService'
import { requireLogin } from '../middleware/auth'
import { requireTurnstile } from '../middleware/turnstile'
import { zValidatorHook } from '../utils/zodHelper'
import { paginationQuerySchema } from '../utils/pagination'
import threads from './threads'

// チェーンで書くことで hc() のRPC型推論にルートスキーマが正しく伝播する。
// zValidator はリクエストボディの型を hc() のRPCスキーマに乗せるために付与している
// (ハンドラ自身も引き続き service 層で同じスキーマを検証するため、二重チェックになるが安全側)。
const boards = new Hono<AppEnv>()
  .get('/', zValidator('query', paginationQuerySchema, zValidatorHook), getBoardsHandler)
  .post('/', requireLogin, requireTurnstile, zValidator('json', boardBodySchema, zValidatorHook), createBoardHandler)
  .get('/:boardId', getBoardHandler)
  .put('/:boardId', requireLogin, requireTurnstile, zValidator('json', boardBodySchema, zValidatorHook), putBoardHandler)
  .patch('/:boardId', requireLogin, requireTurnstile, zValidator('json', patchBoardSchema, zValidatorHook), patchBoardHandler)
  .delete('/:boardId', requireLogin, requireTurnstile, deleteBoardHandler)
  // ── スレッド・投稿 (ネスト) ───────────────────────────────
  .route('/:boardId/threads', threads)

export default boards
