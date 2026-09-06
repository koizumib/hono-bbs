import { Hono } from 'hono'
import type { AppEnv } from '../types'
import {
  setupHandler,
  loginHandler,
  logoutHandler,
} from '../handlers/authHandler'
import { requireLogin } from '../middleware/auth'
import { turnstilePageHandler, turnstileVerifyHandler } from '../features/turnstile/handler'

const auth = new Hono<AppEnv>()

auth.post('/setup', setupHandler)
auth.post('/login', loginHandler)
auth.post('/logout', requireLogin, logoutHandler)

// 旧 turnstileApiToken プラグイン (別Workerだった) を本体に統合
auth.get('/turnstile', turnstilePageHandler)
auth.post('/turnstile', turnstileVerifyHandler)

export default auth
