import { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono'
import type { AppEnv } from '../types'
import * as handler from '../features/imageUpload/handler'
import { requireTurnstile } from '../middleware/turnstile'

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

// 旧 imageUploader プラグイン (別Workerだった) を本体に統合
const images = new Hono<AppEnv>()

images.post('/upload/request', requireTurnstile, handler.requestUploadHandler)
images.post('/upload/confirm/:imageId', handler.confirmUploadHandler)
images.get('/images/:imageId', handler.getImageHandler)
images.post('/images/:imageId/report', handler.reportImageHandler)
// 投稿者自身による削除: deleteToken を URL に含める (:deleteToken より先に定義)
images.delete('/images/:imageId/:deleteToken', handler.userDeleteImageHandler)
// 管理者削除: Authorization: Bearer <ADMIN_API_KEY>
images.delete('/images/:imageId', requireAdmin, handler.deleteImageHandler)

export default images
