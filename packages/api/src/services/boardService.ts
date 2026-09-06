import { z } from 'zod'
import type { Board } from '../types'
import type { DbAdapter } from '../adapters/db'
import * as boardRepository from '../repository/boardRepository'
import type { BoardCursor } from '../repository/boardRepository'
import { can, buildAcl, resourceAclInputSchema } from '../utils/acl'
import { encodeCursor, decodeCursor, type PaginationQuery, type Page } from '../utils/pagination'

const ID_FORMATS = ['daily_hash', 'daily_hash_or_user', 'api_key_hash', 'api_key_hash_or_user', 'none'] as const

// POST /boards および PUT /boards/:boardId (upsert) で使用: 全フィールド必須
export const boardBodySchema = z.object({
  id: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_\-\.]+$/, 'IDは英数字・_・-・. のみ使用できます').optional(),
  name: z.string().min(1).max(100),
  description: z.string().max(1000),
  acl: resourceAclInputSchema,
  maxThreads: z.number().int().min(0),
  maxThreadTitleLength: z.number().int().min(0),
  defaultMaxPosts: z.number().int().min(0),
  defaultMaxPostLength: z.number().int().min(0),
  defaultMaxPostLines: z.number().int().min(0),
  defaultMaxPosterNameLength: z.number().int().min(0),
  defaultMaxPosterOptionLength: z.number().int().min(0),
  defaultPosterName: z.string().min(1).max(50),
  defaultIdFormat: z.enum(ID_FORMATS),
  // スレッド/レス作成時に instantiateAcl() でコピーされるテンプレート
  defaultThreadAcl: resourceAclInputSchema,
  defaultPostAcl: resourceAclInputSchema,
  category: z.string().max(128).optional(),
})

// PATCH /boards/:boardId: 既存の板のみ対象、指定したフィールドだけ更新する (upsertしない)
export const patchBoardSchema = boardBodySchema.omit({ id: true }).partial()

export type BoardBodyInput = z.infer<typeof boardBodySchema>
export type PatchBoardInput = z.infer<typeof patchBoardSchema>

export function parseBoardBody(data: unknown): BoardBodyInput {
  return boardBodySchema.parse(data)
}

export function parsePatchBoard(data: unknown): PatchBoardInput {
  return patchBoardSchema.parse(data)
}

function buildBoardFromInput(
  id: string,
  input: BoardBodyInput,
  creatorUserId: string | null,
  creatorSessionId: string | null,
  creatorTurnstileSessionId: string | null,
  now: string,
): Board {
  return {
    id,
    acl: buildAcl(input.acl, creatorUserId),
    name: input.name,
    description: input.description,
    maxThreads: input.maxThreads,
    maxThreadTitleLength: input.maxThreadTitleLength,
    defaultMaxPosts: input.defaultMaxPosts,
    defaultMaxPostLength: input.defaultMaxPostLength,
    defaultMaxPostLines: input.defaultMaxPostLines,
    defaultMaxPosterNameLength: input.defaultMaxPosterNameLength,
    defaultMaxPosterOptionLength: input.defaultMaxPosterOptionLength,
    defaultPosterName: input.defaultPosterName,
    defaultIdFormat: input.defaultIdFormat,
    // owner は板ではなくスレッド/レス作成時に決まるため、テンプレートは ownerUserId=null で保存
    defaultThreadAcl: buildAcl(input.defaultThreadAcl, null),
    defaultPostAcl: buildAcl(input.defaultPostAcl, null),
    category: input.category ?? '',
    createdAt: now,
    adminMeta: { creatorUserId, creatorSessionId, creatorTurnstileSessionId },
  }
}

// GET /boards/:boardId (板情報のみ)
export async function getBoard(
  db: DbAdapter,
  boardId: string,
  userId: string | null,
  userRoleIds: string[],
  isSysAdmin: boolean,
): Promise<Board | null> {
  const board = await boardRepository.findBoardById(db, boardId)
  if (!board) return null
  if (!can(board.acl, { userId, userRoleIds, isSysAdmin }, 'read')) return null
  return board
}

export async function getBoards(
  db: DbAdapter,
  userId: string | null,
  userRoleIds: string[],
  isSysAdmin: boolean,
  pagination: PaginationQuery,
): Promise<Page<Board>> {
  const cursor = pagination.cursor ? decodeCursor<BoardCursor>(pagination.cursor) : null
  const { items, nextCursorRaw } = await boardRepository.findBoardsPage(db, { limit: pagination.limit, cursor })
  const filtered = isSysAdmin ? items : items.filter(b => can(b.acl, { userId, userRoleIds, isSysAdmin }, 'read'))
  return {
    items: filtered,
    nextCursor: nextCursorRaw ? encodeCursor(nextCursorRaw) : null,
  }
}

// POST /boards: sys admin のみ作成可
export async function createBoard(
  db: DbAdapter,
  input: BoardBodyInput,
  creatorUserId: string | null,
  isSysAdmin: boolean,
  creatorSessionId: string | null,
  creatorTurnstileSessionId: string | null,
): Promise<Board> {
  if (!isSysAdmin) throw new Error('FORBIDDEN')

  const now = new Date().toISOString()
  const id = input.id ?? crypto.randomUUID()

  const board = buildBoardFromInput(id, input, creatorUserId, creatorSessionId, creatorTurnstileSessionId, now)
  await boardRepository.insertBoard(db, board)
  return board
}

// PUT /boards/:boardId: upsert (存在しない場合は sys admin のみ作成可、存在する場合は全フィールドを置換する)
export async function putBoard(
  db: DbAdapter,
  boardId: string,
  input: BoardBodyInput,
  userId: string | null,
  userRoleIds: string[],
  isSysAdmin: boolean,
  creatorSessionId: string | null,
  creatorTurnstileSessionId: string | null,
): Promise<Board> {
  const existing = await boardRepository.findBoardById(db, boardId)

  if (!existing) {
    // 存在しない場合: sys admin のみ作成可
    if (!isSysAdmin) throw new Error('FORBIDDEN')
    const now = new Date().toISOString()
    const board = buildBoardFromInput(boardId, input, userId, creatorSessionId, creatorTurnstileSessionId, now)
    await boardRepository.insertBoard(db, board)
    return board
  }

  // 存在する場合: update 権限チェック (ACLそのものを書き換えられる操作なので owner/sysAdmin 相当が必要)
  if (!can(existing.acl, { userId, userRoleIds, isSysAdmin }, 'update')) throw new Error('FORBIDDEN')

  await boardRepository.updateBoard(db, boardId, {
    acl: buildAcl(input.acl, existing.acl.ownerUserId ?? userId),
    name: input.name,
    description: input.description,
    maxThreads: input.maxThreads,
    maxThreadTitleLength: input.maxThreadTitleLength,
    defaultMaxPosts: input.defaultMaxPosts,
    defaultMaxPostLength: input.defaultMaxPostLength,
    defaultMaxPostLines: input.defaultMaxPostLines,
    defaultMaxPosterNameLength: input.defaultMaxPosterNameLength,
    defaultMaxPosterOptionLength: input.defaultMaxPosterOptionLength,
    defaultPosterName: input.defaultPosterName,
    defaultIdFormat: input.defaultIdFormat,
    defaultThreadAcl: buildAcl(input.defaultThreadAcl, null),
    defaultPostAcl: buildAcl(input.defaultPostAcl, null),
    category: input.category ?? '',
  })
  return (await boardRepository.findBoardById(db, boardId))!
}

// PATCH /boards/:boardId: 既存の板の指定フィールドのみ更新 (upsertしない)
export async function patchBoard(
  db: DbAdapter,
  boardId: string,
  input: PatchBoardInput,
  userId: string | null,
  userRoleIds: string[],
  isSysAdmin: boolean,
): Promise<Board | null> {
  const existing = await boardRepository.findBoardById(db, boardId)
  if (!existing) return null

  if (!can(existing.acl, { userId, userRoleIds, isSysAdmin }, 'update')) throw new Error('FORBIDDEN')

  await boardRepository.updateBoard(db, boardId, {
    acl: input.acl !== undefined ? buildAcl(input.acl, existing.acl.ownerUserId ?? userId) : undefined,
    name: input.name,
    description: input.description,
    maxThreads: input.maxThreads,
    maxThreadTitleLength: input.maxThreadTitleLength,
    defaultMaxPosts: input.defaultMaxPosts,
    defaultMaxPostLength: input.defaultMaxPostLength,
    defaultMaxPostLines: input.defaultMaxPostLines,
    defaultMaxPosterNameLength: input.defaultMaxPosterNameLength,
    defaultMaxPosterOptionLength: input.defaultMaxPosterOptionLength,
    defaultPosterName: input.defaultPosterName,
    defaultIdFormat: input.defaultIdFormat,
    defaultThreadAcl: input.defaultThreadAcl !== undefined ? buildAcl(input.defaultThreadAcl, null) : undefined,
    defaultPostAcl: input.defaultPostAcl !== undefined ? buildAcl(input.defaultPostAcl, null) : undefined,
    category: input.category,
  })
  return (await boardRepository.findBoardById(db, boardId))!
}

export async function deleteBoard(
  db: DbAdapter,
  boardId: string,
  userId: string | null,
  userRoleIds: string[],
  isSysAdmin: boolean,
): Promise<boolean> {
  const board = await boardRepository.findBoardById(db, boardId)
  if (!board) return false

  if (!can(board.acl, { userId, userRoleIds, isSysAdmin }, 'delete')) throw new Error('FORBIDDEN')

  return boardRepository.deleteBoard(db, boardId)
}
