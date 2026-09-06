import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import type { AppEnv } from '../types'
import {
  getPostsHandler,
  getPostHandler,
  createPostHandler,
  putPostHandler,
  patchPostHandler,
  deletePostHandler,
} from '../handlers/postHandler'
import { createPostSchema, updatePostSchema, patchPostSchema } from '../services/postService'
import { requireLogin } from '../middleware/auth'
import { requireTurnstile } from '../middleware/turnstile'
import { rateLimit } from '../middleware/rateLimit'
import { zValidatorHook } from '../utils/zodHelper'
import { paginationQuerySchema } from '../utils/pagination'

const postCreateRateLimit = rateLimit({
  keyPrefix: 'post-create',
  keyFn: (c) => c.get('turnstileSessionId') ?? c.req.header('CF-Connecting-IP') ?? 'unknown',
  limitEnvKey: 'POST_CREATE_RATE_LIMIT',
  windowEnvKey: 'POST_CREATE_RATE_WINDOW',
})

// /boards/:boardId/threads/:threadId/posts にマウントされる
// チェーンで書くことで hc() のRPC型推論にルートスキーマが正しく伝播する
const posts = new Hono<AppEnv>()
  .get('/', zValidator('query', paginationQuerySchema, zValidatorHook), getPostsHandler)
  .post('/', requireTurnstile, postCreateRateLimit, zValidator('json', createPostSchema, zValidatorHook), createPostHandler)
  .get('/:postNumber', getPostHandler)
  .put('/:postNumber', requireTurnstile, zValidator('json', updatePostSchema, zValidatorHook), putPostHandler)
  .patch('/:postNumber', requireLogin, requireTurnstile, zValidator('json', patchPostSchema, zValidatorHook), patchPostHandler)
  .delete('/:postNumber', requireTurnstile, deletePostHandler)

export default posts
