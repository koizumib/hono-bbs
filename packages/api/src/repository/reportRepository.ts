import type { Report, ReportStatus, ReportTargetType } from '../types'
import type { DbAdapter } from '../adapters/db'

type ReportRow = {
  id: string
  target_type: string
  board_id: string
  thread_id: string
  post_number: number | null
  content_snapshot: string
  reporter_turnstile_session_id: string | null
  status: string
  created_at: string
  resolved_at: string | null
  resolved_by: string | null
}

function rowToReport(row: ReportRow): Report {
  return {
    id: row.id,
    targetType: row.target_type as ReportTargetType,
    boardId: row.board_id,
    threadId: row.thread_id,
    postNumber: row.post_number,
    contentSnapshot: row.content_snapshot,
    reporterTurnstileSessionId: row.reporter_turnstile_session_id,
    status: row.status as ReportStatus,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
  }
}

export async function insertReport(db: DbAdapter, report: Report): Promise<void> {
  await db.run(
    `INSERT INTO reports (
      id, target_type, board_id, thread_id, post_number,
      content_snapshot, reporter_turnstile_session_id, status, created_at
    ) VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      report.id, report.targetType, report.boardId, report.threadId, report.postNumber,
      report.contentSnapshot, report.reporterTurnstileSessionId, report.status, report.createdAt,
    ],
  )
}

export async function findReportById(db: DbAdapter, id: string): Promise<Report | null> {
  const row = await db.first<ReportRow>('SELECT * FROM reports WHERE id = ?', [id])
  return row ? rowToReport(row) : null
}

export async function listReports(
  db: DbAdapter,
  status: ReportStatus | null,
  page: number,
  limit: number,
): Promise<Report[]> {
  const offset = (page - 1) * limit
  if (status) {
    const result = await db.all<ReportRow>(
      'SELECT * FROM reports WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [status, limit, offset],
    )
    return result.results.map(rowToReport)
  }
  const result = await db.all<ReportRow>(
    'SELECT * FROM reports ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [limit, offset],
  )
  return result.results.map(rowToReport)
}

export async function updateReportStatus(
  db: DbAdapter,
  id: string,
  status: ReportStatus,
  resolvedAt: string,
  resolvedBy: string | null,
): Promise<boolean> {
  const result = await db.run(
    'UPDATE reports SET status = ?, resolved_at = ?, resolved_by = ? WHERE id = ?',
    [status, resolvedAt, resolvedBy, id],
  )
  return result.changes > 0
}
