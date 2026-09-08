import type { Context } from 'hono'
import type { AppEnv, ReportStatus } from '../types'
import { isZodError, zodMessage } from '../utils/zodHelper'
import * as ipBanService from '../services/ipBanService'
import * as reportService from '../services/reportService'

// Input を any にしているのは、zValidator が付与する入力スキーマをハンドラ側の型注釈で
// 上書き・消失させないため (identityHandler.ts 等と同じ理由)
type IpBansRootContext = Context<AppEnv, '/ip-bans', any>
type IpBanIdContext = Context<AppEnv, '/ip-bans/:id', any>
type ReportsRootContext = Context<AppEnv, '/reports', any>
type ReportIdContext = Context<AppEnv, '/reports/:id/:action', any>

const PAGE_LIMIT = 50

// ── IPBAN ──────────────────────────────────────────────

// GET /moderation/ip-bans?page=<n>
export async function listIpBansHandler(c: IpBansRootContext) {
  const page = Math.max(1, parseInt(c.req.query('page') ?? '1', 10))
  try {
    const bans = await ipBanService.listIpBans(c.get('db'), c.get('isSysAdmin'), page, PAGE_LIMIT)
    return c.json({ data: bans, page, limit: PAGE_LIMIT })
  } catch (e) {
    if (e instanceof Error && e.message === 'FORBIDDEN') {
      return c.json({ error: 'FORBIDDEN', message: 'Insufficient permissions' }, 403)
    }
    throw e
  }
}

// POST /moderation/ip-bans
export async function createIpBanHandler(c: IpBansRootContext) {
  try {
    const body = await c.req.json()
    const input = ipBanService.parseCreateIpBan(body)
    const ban = await ipBanService.createIpBan(c.get('db'), c.get('isSysAdmin'), input, c.get('userId'))
    return c.json({ data: ban }, 201)
  } catch (e) {
    if (isZodError(e)) return c.json({ error: 'VALIDATION_ERROR', message: zodMessage(e) }, 400)
    if (e instanceof Error) {
      if (e.message === 'FORBIDDEN') return c.json({ error: 'FORBIDDEN', message: 'Insufficient permissions' }, 403)
      if (e.message === 'ALREADY_BANNED') return c.json({ error: 'ALREADY_BANNED', message: 'This IP is already banned' }, 409)
    }
    throw e
  }
}

// DELETE /moderation/ip-bans/:id
export async function deleteIpBanHandler(c: IpBanIdContext) {
  const id = c.req.param('id')
  try {
    const deleted = await ipBanService.deleteIpBan(c.get('db'), c.get('isSysAdmin'), id)
    if (!deleted) return c.json({ error: 'IP_BAN_NOT_FOUND', message: 'IP ban not found' }, 404)
    return new Response(null, { status: 204 })
  } catch (e) {
    if (e instanceof Error && e.message === 'FORBIDDEN') {
      return c.json({ error: 'FORBIDDEN', message: 'Insufficient permissions' }, 403)
    }
    throw e
  }
}

// ── 通報キュー ──────────────────────────────────────────

// GET /moderation/reports?status=<open|resolved|dismissed>&page=<n>
export async function listReportsHandler(c: ReportsRootContext) {
  const page = Math.max(1, parseInt(c.req.query('page') ?? '1', 10))
  const statusParam = c.req.query('status')
  const status = (statusParam === 'open' || statusParam === 'resolved' || statusParam === 'dismissed')
    ? statusParam as ReportStatus
    : null
  try {
    const reports = await reportService.listReports(c.get('db'), c.get('isSysAdmin'), status, page, PAGE_LIMIT)
    return c.json({ data: reports, page, limit: PAGE_LIMIT })
  } catch (e) {
    if (e instanceof Error && e.message === 'FORBIDDEN') {
      return c.json({ error: 'FORBIDDEN', message: 'Insufficient permissions' }, 403)
    }
    throw e
  }
}

// POST /moderation/reports/:id/resolve, /moderation/reports/:id/dismiss
async function setReportStatusHandler(c: ReportIdContext, status: 'resolved' | 'dismissed') {
  const id = c.req.param('id')
  try {
    const updated = await reportService.setReportStatus(c.get('db'), c.get('isSysAdmin'), id, status, c.get('userId'))
    if (!updated) return c.json({ error: 'REPORT_NOT_FOUND', message: 'Report not found' }, 404)
    return c.json({ data: { message: `Report marked as ${status}` } })
  } catch (e) {
    if (e instanceof Error && e.message === 'FORBIDDEN') {
      return c.json({ error: 'FORBIDDEN', message: 'Insufficient permissions' }, 403)
    }
    throw e
  }
}

export function resolveReportHandler(c: ReportIdContext) {
  return setReportStatusHandler(c, 'resolved')
}

export function dismissReportHandler(c: ReportIdContext) {
  return setReportStatusHandler(c, 'dismissed')
}
