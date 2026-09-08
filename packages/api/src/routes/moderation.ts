import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import type { AppEnv } from '../types'
import {
  listIpBansHandler,
  createIpBanHandler,
  deleteIpBanHandler,
  listReportsHandler,
  resolveReportHandler,
  dismissReportHandler,
} from '../handlers/moderationHandler'
import { createIpBanSchema, listIpBansQuerySchema } from '../services/ipBanService'
import { listReportsQuerySchema } from '../services/reportService'
import { requireLogin, requireSysAdmin } from '../middleware/auth'
import { requireTurnstile } from '../middleware/turnstile'
import { zValidatorHook } from '../utils/zodHelper'

// サイト全体のmoderation機能 (IPBAN・スレ/レス通報キュー)。全エンドポイント isSysAdmin 必須。
// チェーンで書くことで hc() のRPC型推論にルートスキーマが正しく伝播する (routes/identity.ts と同じ理由)
const moderation = new Hono<AppEnv>()
  .get('/ip-bans', requireLogin, requireSysAdmin, zValidator('query', listIpBansQuerySchema, zValidatorHook), listIpBansHandler)
  .post('/ip-bans', requireLogin, requireSysAdmin, requireTurnstile, zValidator('json', createIpBanSchema, zValidatorHook), createIpBanHandler)
  .delete('/ip-bans/:id', requireLogin, requireSysAdmin, requireTurnstile, deleteIpBanHandler)
  .get('/reports', requireLogin, requireSysAdmin, zValidator('query', listReportsQuerySchema, zValidatorHook), listReportsHandler)
  .post('/reports/:id/resolve', requireLogin, requireSysAdmin, requireTurnstile, resolveReportHandler)
  .post('/reports/:id/dismiss', requireLogin, requireSysAdmin, requireTurnstile, dismissReportHandler)

export default moderation
