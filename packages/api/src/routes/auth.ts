import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import type { AppEnv } from '../types'
import {
  setupHandler,
  loginHandler,
  logoutHandler,
} from '../handlers/authHandler'
import { loginSchema } from '../services/authService'
import { requireLogin } from '../middleware/auth'
import { zValidatorHook } from '../utils/zodHelper'
import { turnstilePageHandler, turnstileVerifyHandler } from '../features/turnstile/handler'

// チェーンで書くことで hc() のRPC型推論にルートスキーマが正しく伝播する (routes/boards.ts と同じ理由)。
const auth = new Hono<AppEnv>()
  .post('/setup', setupHandler)
  .post('/login', zValidator('json', loginSchema, zValidatorHook), loginHandler)
  .post('/logout', requireLogin, logoutHandler)
  // 旧 turnstileApiToken プラグイン (別Workerだった) を本体に統合
  .get('/turnstile', turnstilePageHandler)
  .post('/turnstile', turnstileVerifyHandler)

export default auth
