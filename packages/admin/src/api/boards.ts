import type { InferRequestType } from 'hono/client'
import { client, unwrap, requireSession, requireTurnstileSession } from './rpcClient'
import type { Board, BoardsResponse, ApiResponse } from './types'

export async function getBoards(params?: { limit?: number; cursor?: string }) {
  return unwrap<BoardsResponse>(client.boards.$get({ query: {
    limit: params?.limit !== undefined ? String(params.limit) : undefined,
    cursor: params?.cursor,
  } }))
}

export async function getBoard(boardId: string) {
  return unwrap<ApiResponse<Board>>(client.boards[':boardId'].$get({ param: { boardId } }))
}

export type CreateBoardInput = InferRequestType<typeof client.boards.$post>['json']

export async function createBoard(input: CreateBoardInput) {
  requireSession()
  requireTurnstileSession()
  return unwrap<ApiResponse<Board>>(client.boards.$post({ json: input }))
}

export type PatchBoardInput = InferRequestType<(typeof client.boards)[':boardId']['$patch']>['json']

export async function patchBoard(boardId: string, input: PatchBoardInput) {
  requireSession()
  requireTurnstileSession()
  return unwrap<ApiResponse<Board>>(client.boards[':boardId'].$patch({ param: { boardId }, json: input }))
}

export async function deleteBoard(boardId: string) {
  requireSession()
  requireTurnstileSession()
  return unwrap<void>(client.boards[':boardId'].$delete({ param: { boardId } }))
}
