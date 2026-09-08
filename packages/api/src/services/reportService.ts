import { z } from 'zod'
import type { DbAdapter } from '../adapters/db'
import type { Report, ReportStatus } from '../types'
import * as reportRepository from '../repository/reportRepository'
import * as threadRepository from '../repository/threadRepository'
import * as postRepository from '../repository/postRepository'

// GET /moderation/reports の ?page=&status= クエリ
export const listReportsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  status: z.enum(['open', 'resolved', 'dismissed']).optional(),
})

// ── 公開エンドポイント (誰でも通報できる。権限チェック無し) ──────────────

export async function reportThread(
  db: DbAdapter,
  boardId: string,
  threadId: string,
  turnstileSessionId: string | null,
): Promise<Report> {
  const thread = await threadRepository.findThreadById(db, threadId)
  if (!thread || thread.boardId !== boardId) throw new Error('THREAD_NOT_FOUND')

  const report: Report = {
    id: crypto.randomUUID(),
    targetType: 'thread',
    boardId,
    threadId,
    postNumber: null,
    contentSnapshot: thread.title,
    reporterTurnstileSessionId: turnstileSessionId,
    status: 'open',
    createdAt: new Date().toISOString(),
    resolvedAt: null,
    resolvedBy: null,
  }
  await reportRepository.insertReport(db, report)
  return report
}

export async function reportPost(
  db: DbAdapter,
  boardId: string,
  threadId: string,
  postNumber: number,
  turnstileSessionId: string | null,
): Promise<Report> {
  const thread = await threadRepository.findThreadById(db, threadId)
  if (!thread || thread.boardId !== boardId) throw new Error('THREAD_NOT_FOUND')

  const post = await postRepository.findPostByNumber(db, threadId, postNumber)
  if (!post) throw new Error('POST_NOT_FOUND')

  const report: Report = {
    id: crypto.randomUUID(),
    targetType: 'post',
    boardId,
    threadId,
    postNumber,
    contentSnapshot: post.content,
    reporterTurnstileSessionId: turnstileSessionId,
    status: 'open',
    createdAt: new Date().toISOString(),
    resolvedAt: null,
    resolvedBy: null,
  }
  await reportRepository.insertReport(db, report)
  return report
}

// ── 管理者向け (isSysAdmin のみ) ──────────────────────────────────

export async function listReports(
  db: DbAdapter,
  isSysAdmin: boolean,
  status: ReportStatus | null,
  page: number,
  limit: number,
): Promise<Report[]> {
  if (!isSysAdmin) throw new Error('FORBIDDEN')
  return reportRepository.listReports(db, status, page, limit)
}

export async function setReportStatus(
  db: DbAdapter,
  isSysAdmin: boolean,
  id: string,
  status: 'resolved' | 'dismissed',
  resolvedBy: string | null,
): Promise<boolean> {
  if (!isSysAdmin) throw new Error('FORBIDDEN')
  const report = await reportRepository.findReportById(db, id)
  if (!report) return false
  return reportRepository.updateReportStatus(db, id, status, new Date().toISOString(), resolvedBy)
}
