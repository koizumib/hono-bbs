import type { InferRequestType } from 'hono/client'
import { client, unwrap, requireSession, requireTurnstileSession } from './rpcClient'
import type { Thread, ThreadsResponse, ApiResponse } from './types'

export async function getThreads(boardId: string, params?: { limit?: number; cursor?: string; includeArchived?: boolean }) {
  return unwrap<ThreadsResponse>(client.boards[':boardId'].threads.$get({
    param: { boardId },
    query: {
      limit: params?.limit !== undefined ? String(params.limit) : undefined,
      cursor: params?.cursor,
      includeArchived: params?.includeArchived ? 'true' : undefined,
    },
  }))
}

export async function getThread(boardId: string, threadId: string) {
  return unwrap<ApiResponse<Thread>>(client.boards[':boardId'].threads[':threadId'].$get({ param: { boardId, threadId } }))
}

export type PatchThreadInput = InferRequestType<(typeof client.boards)[':boardId']['threads'][':threadId']['$patch']>['json']

// PATCH: 既存スレッドの指定フィールドのみ更新 (upsertしない)。モデレーションでのACL変更もこれを使う。
export async function patchThread(boardId: string, threadId: string, input: PatchThreadInput) {
  requireSession()
  requireTurnstileSession()
  return unwrap<ApiResponse<Thread>>(client.boards[':boardId'].threads[':threadId'].$patch({ param: { boardId, threadId }, json: input }))
}

export async function deleteThread(boardId: string, threadId: string) {
  requireSession()
  requireTurnstileSession()
  return unwrap<void>(client.boards[':boardId'].threads[':threadId'].$delete({ param: { boardId, threadId } }))
}
