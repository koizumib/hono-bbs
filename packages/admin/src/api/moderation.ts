import type { InferRequestType } from 'hono/client'
import { client, unwrap, requireSession, requireTurnstileSession } from './rpcClient'
import type { ApiResponse, IpBansResponse, IpBan, ReportsResponse } from './types'

// ── IPBAN ──────────────────────────────────────────────

export async function getIpBans(page = 1) {
  requireSession()
  return unwrap<IpBansResponse>(client.moderation['ip-bans'].$get({ query: { page: String(page) } }))
}

export type CreateIpBanInput = InferRequestType<(typeof client.moderation)['ip-bans']['$post']>['json']

export async function createIpBan(input: CreateIpBanInput) {
  requireSession()
  requireTurnstileSession()
  return unwrap<ApiResponse<IpBan>>(client.moderation['ip-bans'].$post({ json: input }))
}

export async function deleteIpBan(id: string) {
  requireSession()
  requireTurnstileSession()
  return unwrap<void>(client.moderation['ip-bans'][':id'].$delete({ param: { id } }))
}

// ── 通報キュー ──────────────────────────────────────────

export async function getReports(page = 1, status?: 'open' | 'resolved' | 'dismissed') {
  requireSession()
  return unwrap<ReportsResponse>(
    client.moderation.reports.$get({ query: { page: String(page), status } }),
  )
}

export async function resolveReport(id: string) {
  requireSession()
  requireTurnstileSession()
  return unwrap<ApiResponse<{ message: string }>>(client.moderation.reports[':id'].resolve.$post({ param: { id } }))
}

export async function dismissReport(id: string) {
  requireSession()
  requireTurnstileSession()
  return unwrap<ApiResponse<{ message: string }>>(client.moderation.reports[':id'].dismiss.$post({ param: { id } }))
}
