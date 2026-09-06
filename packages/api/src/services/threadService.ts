import { z } from 'zod'
import type { Thread, Post } from '../types'
import type { DbAdapter } from '../adapters/db'
import * as threadRepository from '../repository/threadRepository'
import type { ThreadCursor } from '../repository/threadRepository'
import * as boardRepository from '../repository/boardRepository'
import * as postRepository from '../repository/postRepository'
import { can, buildAcl, instantiateAcl, resourceAclInputSchema } from '../utils/acl'
import { computeDisplayUserId } from '../utils/hash'
import { encodeCursor, decodeCursor, type PaginationQuery, type Page } from '../utils/pagination'

const ID_FORMATS = ['daily_hash', 'daily_hash_or_user', 'api_key_hash', 'api_key_hash_or_user', 'none'] as const

export const createThreadSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().min(1).max(10000),
  posterName: z.string().max(50).optional(),
  posterOptionInfo: z.string().max(100).optional(),
})

// PUT: upsert。全フィールドが確定値になるスキーマ (冪等な全体置換のため)
export const putThreadSchema = z.object({
  title: z.string().min(1).max(500),
  posterName: z.string().max(50).default(''),
  acl: resourceAclInputSchema,
  maxPosts: z.number().int().min(0).default(0),
  maxPostLength: z.number().int().min(0).default(0),
  maxPostLines: z.number().int().min(0).default(0),
  maxPosterNameLength: z.number().int().min(0).default(0),
  maxPosterOptionLength: z.number().int().min(0).default(0),
  idFormat: z.enum([...ID_FORMATS, '']).default(''),
})

// PATCH: 既存スレッドの指定フィールドのみ更新 (upsertしない)
export const patchThreadSchema = z.object({
  acl: resourceAclInputSchema.optional(),
  title: z.string().min(1).max(500).optional(),
  posterName: z.string().max(50).optional(),
  maxPosts: z.number().int().min(0).optional(),
  maxPostLength: z.number().int().min(0).optional(),
  maxPostLines: z.number().int().min(0).optional(),
  maxPosterNameLength: z.number().int().min(0).optional(),
  maxPosterOptionLength: z.number().int().min(0).optional(),
  idFormat: z.enum([...ID_FORMATS, '']).optional(),
})

export type CreateThreadInput = z.infer<typeof createThreadSchema>
export type PutThreadInput = z.infer<typeof putThreadSchema>
export type PatchThreadInput = z.infer<typeof patchThreadSchema>

export function parseCreateThread(data: unknown): CreateThreadInput {
  return createThreadSchema.parse(data)
}

export function parsePutThread(data: unknown): PutThreadInput {
  return putThreadSchema.parse(data)
}

export function parsePatchThread(data: unknown): PatchThreadInput {
  return patchThreadSchema.parse(data)
}

// GET /boards/:boardId/threads (スレッド一覧、limit/cursorページネーション)
export async function getThreads(
  db: DbAdapter,
  boardId: string,
  userId: string | null,
  userRoleIds: string[],
  isSysAdmin: boolean,
  pagination: PaginationQuery,
): Promise<Page<Thread> | null> {
  const board = await boardRepository.findBoardById(db, boardId)
  if (!board) return null
  if (!can(board.acl, { userId, userRoleIds, isSysAdmin }, 'read')) return null

  const cursor = pagination.cursor ? decodeCursor<ThreadCursor>(pagination.cursor) : null
  const { items, nextCursorRaw } = await threadRepository.findThreadsByBoardIdPage(db, boardId, {
    limit: pagination.limit,
    cursor,
  })
  const filtered = isSysAdmin ? items : items.filter(t => can(t.acl, { userId, userRoleIds, isSysAdmin }, 'read'))
  return {
    items: filtered,
    nextCursor: nextCursorRaw ? encodeCursor(nextCursorRaw) : null,
  }
}

// GET /boards/:boardId/threads/:threadId (スレッド情報のみ)
export async function getThread(
  db: DbAdapter,
  boardId: string,
  threadId: string,
  userId: string | null,
  userRoleIds: string[],
  isSysAdmin: boolean,
): Promise<Thread | null> {
  const thread = await threadRepository.findThreadById(db, threadId)
  if (!thread || thread.boardId !== boardId) return null
  if (!can(thread.acl, { userId, userRoleIds, isSysAdmin }, 'read')) return null
  return thread
}

export async function createThread(
  db: DbAdapter,
  boardId: string,
  input: CreateThreadInput,
  userId: string | null,
  userRoleIds: string[],
  isSysAdmin: boolean,
  sessionId: string | null,
  turnstileSessionId: string | null,
): Promise<{ thread: Thread; firstPost: Post }> {
  const board = await boardRepository.findBoardById(db, boardId)
  if (!board) throw new Error('BOARD_NOT_FOUND')

  if (!can(board.acl, { userId, userRoleIds, isSysAdmin }, 'create')) throw new Error('FORBIDDEN')

  // スレッド数上限チェック (0=無制限)
  if (board.maxThreads > 0) {
    const existing = await threadRepository.findThreadsByBoardId(db, boardId)
    if (existing.length >= board.maxThreads) throw new Error('THREAD_LIMIT_REACHED')
  }

  // タイトル長チェック
  if (board.maxThreadTitleLength > 0 && input.title.length > board.maxThreadTitleLength) {
    throw new Error('TITLE_TOO_LONG')
  }

  // 本文の文字数・行数チェック (board デフォルト値で)
  if (board.defaultMaxPostLength > 0 && input.content.length > board.defaultMaxPostLength) {
    throw new Error('CONTENT_TOO_LONG')
  }
  if (board.defaultMaxPostLines > 0 && input.content.split('\n').length > board.defaultMaxPostLines) {
    throw new Error('CONTENT_TOO_MANY_LINES')
  }

  const now = new Date().toISOString()

  // 板の defaultThreadAcl テンプレートから、作成者をownerにしたACLを作る
  const threadAcl = instantiateAcl(board.defaultThreadAcl, userId)

  const thread: Thread = {
    id: crypto.randomUUID(),
    boardId,
    acl: threadAcl,
    title: input.title,
    maxPosts: 0,
    maxPostLength: 0,
    maxPostLines: 0,
    maxPosterNameLength: 0,
    maxPosterOptionLength: 0,
    posterName: '',
    idFormat: '',
    postCount: 1,
    isEdited: false,
    editedAt: null,
    createdAt: now,
    updatedAt: now,
    adminMeta: { creatorUserId: userId, creatorSessionId: sessionId, creatorTurnstileSessionId: turnstileSessionId },
  }
  await threadRepository.insertThread(db, thread)

  // 第1レスを作成
  const idFormat = board.defaultIdFormat
  const authorId = await computeDisplayUserId(idFormat, userId, turnstileSessionId)
  const posterName = input.posterName ?? board.defaultPosterName

  // 板の defaultPostAcl テンプレートから、作成者をownerにしたACLを作る
  const postAcl = instantiateAcl(board.defaultPostAcl, userId)

  const firstPost: Post = {
    id: crypto.randomUUID(),
    threadId: thread.id,
    postNumber: 1,
    acl: postAcl,
    authorId,
    posterName,
    posterOptionInfo: input.posterOptionInfo ?? '',
    content: input.content,
    isDeleted: false,
    isEdited: false,
    editedAt: null,
    createdAt: now,
    adminMeta: { creatorUserId: userId, creatorSessionId: sessionId, creatorTurnstileSessionId: turnstileSessionId },
  }
  await postRepository.insertPost(db, firstPost)

  return { thread, firstPost }
}

// PUT: upsert (存在しなければ sys admin のみ作成可、存在すれば全フィールドを置換する)
export async function putThread(
  db: DbAdapter,
  boardId: string,
  threadId: string,
  input: PutThreadInput,
  userId: string | null,
  userRoleIds: string[],
  isSysAdmin: boolean,
  sessionId: string | null,
  turnstileSessionId: string | null,
): Promise<Thread> {
  const existing = await threadRepository.findThreadById(db, threadId)

  if (!existing) {
    if (!isSysAdmin) throw new Error('FORBIDDEN')
    const board = await boardRepository.findBoardById(db, boardId)
    if (!board) throw new Error('BOARD_NOT_FOUND')
    const now = new Date().toISOString()
    const thread: Thread = {
      id: threadId,
      boardId,
      acl: buildAcl(input.acl, userId),
      title: input.title,
      maxPosts: input.maxPosts,
      maxPostLength: input.maxPostLength,
      maxPostLines: input.maxPostLines,
      maxPosterNameLength: input.maxPosterNameLength,
      maxPosterOptionLength: input.maxPosterOptionLength,
      posterName: input.posterName,
      idFormat: input.idFormat,
      postCount: 0,
      isEdited: false,
      editedAt: null,
      createdAt: now,
      updatedAt: now,
      adminMeta: { creatorUserId: userId, creatorSessionId: sessionId, creatorTurnstileSessionId: turnstileSessionId },
    }
    await threadRepository.insertThread(db, thread)
    return thread
  }

  if (!can(existing.acl, { userId, userRoleIds, isSysAdmin }, 'update')) throw new Error('FORBIDDEN')

  await threadRepository.updateThread(db, threadId, {
    acl: buildAcl(input.acl, existing.acl.ownerUserId ?? userId),
    title: input.title,
    posterName: input.posterName,
    maxPosts: input.maxPosts,
    maxPostLength: input.maxPostLength,
    maxPostLines: input.maxPostLines,
    maxPosterNameLength: input.maxPosterNameLength,
    maxPosterOptionLength: input.maxPosterOptionLength,
    idFormat: input.idFormat,
  })
  return (await threadRepository.findThreadById(db, threadId))!
}

// PATCH: 既存スレッドの指定フィールドのみ更新 (upsertしない)
export async function patchThread(
  db: DbAdapter,
  boardId: string,
  threadId: string,
  input: PatchThreadInput,
  userId: string | null,
  userRoleIds: string[],
  isSysAdmin: boolean,
): Promise<Thread | null> {
  const existing = await threadRepository.findThreadById(db, threadId)
  if (!existing || existing.boardId !== boardId) return null

  if (!can(existing.acl, { userId, userRoleIds, isSysAdmin }, 'update')) throw new Error('FORBIDDEN')

  const acl = input.acl !== undefined
    ? buildAcl(input.acl, existing.acl.ownerUserId ?? userId)
    : undefined

  await threadRepository.updateThread(db, threadId, {
    acl,
    title: input.title,
    posterName: input.posterName,
    maxPosts: input.maxPosts,
    maxPostLength: input.maxPostLength,
    maxPostLines: input.maxPostLines,
    maxPosterNameLength: input.maxPosterNameLength,
    maxPosterOptionLength: input.maxPosterOptionLength,
    idFormat: input.idFormat,
  })
  return (await threadRepository.findThreadById(db, threadId))!
}

export async function deleteThread(
  db: DbAdapter,
  boardId: string,
  threadId: string,
  userId: string | null,
  userRoleIds: string[],
  isSysAdmin: boolean,
): Promise<boolean> {
  const thread = await threadRepository.findThreadById(db, threadId)
  if (!thread || thread.boardId !== boardId) return false

  if (!can(thread.acl, { userId, userRoleIds, isSysAdmin }, 'delete')) throw new Error('FORBIDDEN')

  return threadRepository.deleteThread(db, threadId)
}
