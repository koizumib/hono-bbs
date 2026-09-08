import { z } from 'zod'
import type { DbAdapter } from '../adapters/db'
import type { IpBan } from '../types'
import * as ipBanRepository from '../repository/ipBanRepository'

export const createIpBanSchema = z.object({
  ip: z.string().min(1).max(64),
  reason: z.string().max(500).optional(),
})
export type CreateIpBanInput = z.infer<typeof createIpBanSchema>

export function parseCreateIpBan(data: unknown): CreateIpBanInput {
  return createIpBanSchema.parse(data)
}

// GET /moderation/ip-bans の ?page= クエリ (identityService の pageQuerySchema と同じ方式)
export const listIpBansQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
})

// requireTurnstile/rateLimit等のミドルウェアから使う内部チェック (権限不要)
export async function isIpBanned(db: DbAdapter, ip: string): Promise<boolean> {
  return ipBanRepository.isIpBanned(db, ip)
}

export async function listIpBans(
  db: DbAdapter,
  isSysAdmin: boolean,
  page: number,
  limit: number,
): Promise<IpBan[]> {
  if (!isSysAdmin) throw new Error('FORBIDDEN')
  return ipBanRepository.listIpBans(db, page, limit)
}

export async function createIpBan(
  db: DbAdapter,
  isSysAdmin: boolean,
  input: CreateIpBanInput,
  createdBy: string | null,
): Promise<IpBan> {
  if (!isSysAdmin) throw new Error('FORBIDDEN')
  if (await ipBanRepository.isIpBanned(db, input.ip)) throw new Error('ALREADY_BANNED')

  const ban: IpBan = {
    id: crypto.randomUUID(),
    ip: input.ip,
    reason: input.reason ?? null,
    createdAt: new Date().toISOString(),
    createdBy,
  }
  await ipBanRepository.insertIpBan(db, ban)
  return ban
}

export async function deleteIpBan(db: DbAdapter, isSysAdmin: boolean, id: string): Promise<boolean> {
  if (!isSysAdmin) throw new Error('FORBIDDEN')
  return ipBanRepository.deleteIpBan(db, id)
}
