import type { InferRequestType } from 'hono/client'
import { client, unwrap, requireSession, requireTurnstileSession } from './rpcClient'
import type { Thread, ThreadsResponse, CreateThreadResponse, ApiResponse } from './types'

export async function getThreads(boardId: string, params?: { limit?: number; cursor?: string }) {
  return unwrap<ThreadsResponse>(client.boards[':boardId'].threads.$get({
    param: { boardId },
    query: {
      limit: params?.limit !== undefined ? String(params.limit) : undefined,
      cursor: params?.cursor,
    },
  }))
}

export async function getThread(boardId: string, threadId: string) {
  return unwrap<ApiResponse<Thread>>(client.boards[':boardId'].threads[':threadId'].$get({ param: { boardId, threadId } }))
}

export type CreateThreadInput = InferRequestType<(typeof client.boards)[':boardId']['threads']['$post']>['json']

export async function createThread(boardId: string, input: CreateThreadInput) {
  requireTurnstileSession()
  return unwrap<CreateThreadResponse>(client.boards[':boardId'].threads.$post({ param: { boardId }, json: input }))
}

export type UpdateThreadInput = InferRequestType<(typeof client.boards)[':boardId']['threads'][':threadId']['$patch']>['json']

// PATCH: 既存スレッドの指定フィールドのみ更新 (upsertしない)
export async function updateThread(boardId: string, threadId: string, input: UpdateThreadInput) {
  requireSession()
  requireTurnstileSession()
  return unwrap<ApiResponse<Thread>>(client.boards[':boardId'].threads[':threadId'].$patch({ param: { boardId, threadId }, json: input }))
}

export async function deleteThread(boardId: string, threadId: string) {
  requireSession()
  requireTurnstileSession()
  return unwrap<void>(client.boards[':boardId'].threads[':threadId'].$delete({ param: { boardId, threadId } }))
}
