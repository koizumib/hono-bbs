import type { IpBan } from '../types'
import type { DbAdapter } from '../adapters/db'

type IpBanRow = {
  id: string
  ip: string
  reason: string | null
  created_at: string
  created_by: string | null
}

function rowToIpBan(row: IpBanRow): IpBan {
  return {
    id: row.id,
    ip: row.ip,
    reason: row.reason,
    createdAt: row.created_at,
    createdBy: row.created_by,
  }
}

export async function isIpBanned(db: DbAdapter, ip: string): Promise<boolean> {
  const row = await db.first<{ id: string }>('SELECT id FROM ip_bans WHERE ip = ?', [ip])
  return row !== null
}

export async function listIpBans(db: DbAdapter, page: number, limit: number): Promise<IpBan[]> {
  const offset = (page - 1) * limit
  const result = await db.all<IpBanRow>(
    'SELECT * FROM ip_bans ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [limit, offset],
  )
  return result.results.map(rowToIpBan)
}

export async function insertIpBan(db: DbAdapter, ban: IpBan): Promise<void> {
  await db.run(
    'INSERT INTO ip_bans (id, ip, reason, created_at, created_by) VALUES (?,?,?,?,?)',
    [ban.id, ban.ip, ban.reason, ban.createdAt, ban.createdBy],
  )
}

export async function deleteIpBan(db: DbAdapter, id: string): Promise<boolean> {
  const result = await db.run('DELETE FROM ip_bans WHERE id = ?', [id])
  return result.changes > 0
}
