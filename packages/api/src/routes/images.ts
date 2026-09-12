import { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono'
import type { AppEnv } from '../types'
import * as handler from '../features/imageUpload/handler'
import { requireTurnstile } from '../middleware/turnstile'
import { rateLimit } from '../middleware/rateLimit'
import { getClientIp } from '../utils/clientIp'

// 管理者認証ミドルウェア (Bearer トークン)
const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const apiKey = c.env.ADMIN_API_KEY
  if (!apiKey) {
    return c.json({ error: 'FORBIDDEN', message: 'Admin access is not configured' }, 403)
  }
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ') || auth.slice(7) !== apiKey) {
    return c.json({ error: 'UNAUTHORIZED', message: 'Invalid admin API key' }, 401)
  }
  await next()
}

// 通報の連打による嫌がらせ的な大量通報を防ぐ (未認証・IP/Turnstileセッション単位)
const imageReportRateLimit = rateLimit({
  keyPrefix: 'image-report',
  keyFn: (c) => c.get('turnstileSessionId') ?? getClientIp(c) ?? 'unknown',
  limitEnvKey: 'IMAGE_REPORT_RATE_LIMIT',
  windowEnvKey: 'IMAGE_REPORT_RATE_WINDOW',
  // 未設定時の既定値 (1時間あたり)。明示的に"0"を設定した運用者だけが無制限を選べる
  defaultLimit: 10,
})

// 旧 imageUploader プラグイン (別Workerだった) を本体に統合
const images = new Hono<AppEnv>()

images.post('/upload/request', requireTurnstile, handler.requestUploadHandler)
images.post('/upload/confirm/:imageId', handler.confirmUploadHandler)
images.get('/images/:imageId', handler.getImageHandler)
images.post('/images/:imageId/report', imageReportRateLimit, handler.reportImageHandler)
// 投稿者自身による削除: deleteToken を URL に含める (:deleteToken より先に定義)
images.delete('/images/:imageId/:deleteToken', handler.userDeleteImageHandler)
// 管理者削除: Authorization: Bearer <ADMIN_API_KEY>
images.delete('/images/:imageId', requireAdmin, handler.deleteImageHandler)

export default images
