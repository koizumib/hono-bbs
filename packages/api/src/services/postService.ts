import { z } from 'zod'
import type { Post } from '../types'
import type { DbAdapter } from '../adapters/db'
import * as postRepository from '../repository/postRepository'
import * as threadRepository from '../repository/threadRepository'
import * as boardRepository from '../repository/boardRepository'
import { can, buildAcl, instantiateAcl, resourceAclInputSchema } from '../utils/acl'
import { computeDisplayUserId } from '../utils/hash'
import { matchesAnyNgWord } from '../utils/ngWords'
import { encodeCursor, decodeCursor, type PaginationQuery, type Page } from '../utils/pagination'

export const createPostSchema = z.object({
  content: z.string().min(1).max(10000),
  posterName: z.string().max(50).optional(),
  posterOptionInfo: z.string().max(100).optional(),
})

// PUT: content/posterName/posterOptionInfo を冪等に置換する (isEdited フラグを立てる)
export const updatePostSchema = z.object({
  content: z.string().min(1).max(10000),
  posterName: z.string().max(50).default(''),
  posterOptionInfo: z.string().max(100).default(''),
})

export const patchPostSchema = z.object({
  acl: resourceAclInputSchema.optional(),
})

export type CreatePostInput = z.infer<typeof createPostSchema>
export type UpdatePostInput = z.infer<typeof updatePostSchema>
export type PatchPostInput = z.infer<typeof patchPostSchema>

export function parseCreatePost(data: unknown): CreatePostInput {
  return createPostSchema.parse(data)
}

export function parseUpdatePost(data: unknown): UpdatePostInput {
  return updatePostSchema.parse(data)
}

export function parsePatchPost(data: unknown): PatchPostInput {
  return patchPostSchema.parse(data)
}

type PostCursor = { postNumber: number }

// GET /boards/:boardId/threads/:threadId/posts (投稿一覧、limit/cursorページネーション)
export async function getPosts(
  db: DbAdapter,
  boardId: string,
  threadId: string,
  userId: string | null,
  userRoleIds: string[],
  isSysAdmin: boolean,
  pagination: PaginationQuery,
): Promise<Page<Post> | null> {
  const thread = await threadRepository.findThreadById(db, threadId)
  if (!thread || thread.boardId !== boardId) return null
  if (!can(thread.acl, { userId, userRoleIds, isSysAdmin }, 'read')) return null

  const cursor = pagination.cursor ? decodeCursor<PostCursor>(pagination.cursor) : null
  const { items, nextCursorRaw } = await postRepository.findPostsByThreadIdPage(db, threadId, {
    limit: pagination.limit,
    afterPostNumber: cursor?.postNumber ?? null,
  })
  const filtered = isSysAdmin ? items : items.filter(p => can(p.acl, { userId, userRoleIds, isSysAdmin }, 'read'))
  return {
    items: filtered,
    nextCursor: nextCursorRaw !== null ? encodeCursor({ postNumber: nextCursorRaw }) : null,
  }
}

export async function getPostByNumber(
  db: DbAdapter,
  boardId: string,
  threadId: string,
  postNumber: number,
  userId: string | null,
  userRoleIds: string[],
  isSysAdmin: boolean,
): Promise<Post | null> {
  const thread = await threadRepository.findThreadById(db, threadId)
  if (!thread || thread.boardId !== boardId) return null
  if (!can(thread.acl, { userId, userRoleIds, isSysAdmin }, 'read')) return null

  const post = await postRepository.findPostByNumber(db, threadId, postNumber)
  if (!post) return null
  if (!isSysAdmin && !can(post.acl, { userId, userRoleIds, isSysAdmin }, 'read')) return null

  return post
}

export async function createPost(
  db: DbAdapter,
  boardId: string,
  threadId: string,
  input: CreatePostInput,
  userId: string | null,
  userRoleIds: string[],
  isSysAdmin: boolean,
  sessionId: string | null,
  turnstileSessionId: string | null,
): Promise<Post> {
  const thread = await threadRepository.findThreadById(db, threadId)
  if (!thread || thread.boardId !== boardId) throw new Error('THREAD_NOT_FOUND')

  const board = await boardRepository.findBoardById(db, boardId)
  if (!board) throw new Error('BOARD_NOT_FOUND')

  if (!can(thread.acl, { userId, userRoleIds, isSysAdmin }, 'create')) throw new Error('FORBIDDEN')

  // 書き込み数上限チェック (0=無制限, スレッド設定→ボードデフォルト)
  const maxPosts = thread.maxPosts > 0 ? thread.maxPosts : board.defaultMaxPosts
  if (maxPosts > 0 && thread.postCount >= maxPosts) throw new Error('POST_LIMIT_REACHED')

  // 文字数・行数チェック
  const maxLength = thread.maxPostLength > 0 ? thread.maxPostLength : board.defaultMaxPostLength
  const maxLines = thread.maxPostLines > 0 ? thread.maxPostLines : board.defaultMaxPostLines
  if (maxLength > 0 && input.content.length > maxLength) throw new Error('CONTENT_TOO_LONG')
  if (maxLines > 0 && input.content.split('\n').length > maxLines) throw new Error('CONTENT_TOO_MANY_LINES')

  // IDフォーマット (スレッド設定 → ボードデフォルト)
  const idFormat = thread.idFormat || board.defaultIdFormat
  const authorId = await computeDisplayUserId(idFormat, userId, turnstileSessionId)

  // 投稿者名 (入力 → スレッドデフォルト → ボードデフォルト)
  const posterName = input.posterName || thread.posterName || board.defaultPosterName

  // サーバー側NGワードチェック (板単位。一致したら投稿自体を拒否する)
  if (
    matchesAnyNgWord(board.ngWords, 'content', input.content) ||
    matchesAnyNgWord(board.ngWords, 'posterName', posterName)
  ) {
    throw new Error('CONTENT_REJECTED')
  }

  // 連投(コピペ)検知: 同一スレッド内で、直前の投稿と完全に同じ内容なら拒否する
  const latestPost = await postRepository.findLatestPostInThread(db, threadId)
  if (latestPost && !latestPost.isDeleted && latestPost.content === input.content) {
    throw new Error('DUPLICATE_CONTENT')
  }

  const now = new Date().toISOString()
  const postNumber = await postRepository.nextPostNumber(db, threadId)

  // 板の defaultPostAcl テンプレートから、作成者をownerにしたACLを作る
  const acl = instantiateAcl(board.defaultPostAcl, userId)

  const post: Post = {
    id: crypto.randomUUID(),
    threadId,
    postNumber,
    acl,
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

  await postRepository.insertPost(db, post)
  await threadRepository.incrementPostCount(db, threadId, now)

  return post
}

// PUT: content/posterName/posterOptionInfo を冪等に置換し isEdited フラグを立てる
export async function updatePost(
  db: DbAdapter,
  boardId: string,
  threadId: string,
  postNumber: number,
  input: UpdatePostInput,
  userId: string | null,
  userRoleIds: string[],
  isSysAdmin: boolean,
): Promise<Post | null> {
  const thread = await threadRepository.findThreadById(db, threadId)
  if (!thread || thread.boardId !== boardId) return null

  const post = await postRepository.findPostByNumber(db, threadId, postNumber)
  if (!post) return null

  if (!can(post.acl, { userId, userRoleIds, isSysAdmin }, 'update')) throw new Error('FORBIDDEN')

  const now = new Date().toISOString()
  await postRepository.updatePostContent(db, threadId, postNumber, {
    content: input.content,
    posterName: input.posterName,
    posterOptionInfo: input.posterOptionInfo,
    editedAt: now,
  })
  return postRepository.findPostByNumber(db, threadId, postNumber)
}

// PATCH: acl を更新
export async function patchPost(
  db: DbAdapter,
  boardId: string,
  threadId: string,
  postNumber: number,
  input: PatchPostInput,
  userId: string | null,
  userRoleIds: string[],
  isSysAdmin: boolean,
): Promise<Post | null> {
  const thread = await threadRepository.findThreadById(db, threadId)
  if (!thread || thread.boardId !== boardId) return null

  const post = await postRepository.findPostByNumber(db, threadId, postNumber)
  if (!post) return null

  if (!can(post.acl, { userId, userRoleIds, isSysAdmin }, 'update')) throw new Error('FORBIDDEN')

  const acl = input.acl !== undefined ? buildAcl(input.acl, post.acl.ownerUserId ?? userId) : undefined

  await postRepository.patchPost(db, threadId, postNumber, { acl })
  return postRepository.findPostByNumber(db, threadId, postNumber)
}

// DELETE: ソフトデリート。常に成否のみ返す (204 No Content、ボディ無し)
export async function deletePost(
  db: DbAdapter,
  boardId: string,
  threadId: string,
  postNumber: number,
  userId: string | null,
  userRoleIds: string[],
  isSysAdmin: boolean,
): Promise<boolean> {
  const thread = await threadRepository.findThreadById(db, threadId)
  if (!thread || thread.boardId !== boardId) return false

  const post = await postRepository.findPostByNumber(db, threadId, postNumber)
  if (!post) return false

  if (!can(post.acl, { userId, userRoleIds, isSysAdmin }, 'delete')) throw new Error('FORBIDDEN')

  return postRepository.softDeletePost(db, threadId, postNumber)
}
