import type { MiddlewareHandler } from 'hono'
import type { AppEnv } from '../types'
import * as ipBanService from '../services/ipBanService'

// IPBANされたクライアントの書き込み系リクエスト (GET以外) を拒否する。
// 閲覧(GET)は引き続き許可する。DBが未セットアップの場合は素通りさせる。
export const blockBannedIp: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.req.method === 'GET') {
    await next()
    return
  }

  const db = c.get('db')
  if (!db) {
    await next()
    return
  }

  const ip = c.req.header('CF-Connecting-IP')
  if (ip && (await ipBanService.isIpBanned(db, ip))) {
    return c.json({ error: 'IP_BANNED', message: 'This IP address is banned' }, 403)
  }

  await next()
}
