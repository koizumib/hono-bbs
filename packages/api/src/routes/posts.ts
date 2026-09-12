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
  reportPostHandler,
} from '../handlers/postHandler'
import { createPostSchema, updatePostSchema, patchPostSchema } from '../services/postService'
import { requireLogin } from '../middleware/auth'
import { requireTurnstile } from '../middleware/turnstile'
import { rateLimit } from '../middleware/rateLimit'
import { zValidatorHook } from '../utils/zodHelper'
import { paginationQuerySchema } from '../utils/pagination'
import { getClientIp } from '../utils/clientIp'

const postCreateRateLimit = rateLimit({
  keyPrefix: 'post-create',
  keyFn: (c) => c.get('turnstileSessionId') ?? getClientIp(c) ?? 'unknown',
  limitEnvKey: 'POST_CREATE_RATE_LIMIT',
  windowEnvKey: 'POST_CREATE_RATE_WINDOW',
  // POST_CREATE_RATE_LIMIT が未設定のときの既定値 (1時間あたり)。
  // 明示的に "0" を設定した運用者だけが無制限を選べる。
  defaultLimit: 20,
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
  .post('/:postNumber/report', requireTurnstile, reportPostHandler)

export default posts
