import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import type { AppEnv } from '../types'
import {
  getThreadsHandler,
  getThreadHandler,
  createThreadHandler,
  putThreadHandler,
  patchThreadHandler,
  deleteThreadHandler,
  reportThreadHandler,
} from '../handlers/threadHandler'
import { createThreadSchema, putThreadSchema, patchThreadSchema, listThreadsQuerySchema } from '../services/threadService'
import { requireLogin } from '../middleware/auth'
import { requireTurnstile } from '../middleware/turnstile'
import { rateLimit } from '../middleware/rateLimit'
import { zValidatorHook } from '../utils/zodHelper'
import posts from './posts'

const threadCreateRateLimit = rateLimit({
  keyPrefix: 'thread-create',
  keyFn: (c) => c.get('turnstileSessionId') ?? c.req.header('CF-Connecting-IP') ?? 'unknown',
  limitEnvKey: 'THREAD_CREATE_RATE_LIMIT',
  windowEnvKey: 'THREAD_CREATE_RATE_WINDOW',
})

// /boards/:boardId/threads にマウントされる
// チェーンで書くことで hc() のRPC型推論にルートスキーマが正しく伝播する
const threads = new Hono<AppEnv>()
  .get('/', zValidator('query', listThreadsQuerySchema, zValidatorHook), getThreadsHandler)
  .post('/', requireTurnstile, threadCreateRateLimit, zValidator('json', createThreadSchema, zValidatorHook), createThreadHandler)
  .get('/:threadId', getThreadHandler)
  .put('/:threadId', requireLogin, requireTurnstile, zValidator('json', putThreadSchema, zValidatorHook), putThreadHandler)
  .patch('/:threadId', requireLogin, requireTurnstile, zValidator('json', patchThreadSchema, zValidatorHook), patchThreadHandler)
  .delete('/:threadId', requireLogin, requireTurnstile, deleteThreadHandler)
  .post('/:threadId/report', requireTurnstile, reportThreadHandler)
  .route('/:threadId/posts', posts)

export default threads
