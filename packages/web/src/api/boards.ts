import type { InferRequestType } from 'hono/client'
import { client, unwrap, requireSession, requireTurnstileSession } from './rpcClient'
import { getThreads } from './threads'
import type { Board, BoardsResponse, BoardThreadsResponse, ApiResponse } from './types'

export async function getBoards(params?: { limit?: number; cursor?: string }) {
  return unwrap<BoardsResponse>(client.boards.$get({ query: {
    limit: params?.limit !== undefined ? String(params.limit) : undefined,
    cursor: params?.cursor,
  } }))
}

export async function getBoard(boardId: string) {
  return unwrap<ApiResponse<Board>>(client.boards[':boardId'].$get({ param: { boardId } }))
}

// 板情報とスレッド一覧を2リクエストで並列取得し、旧APIと同じ形にまとめる
// (バックエンドは GET /boards/:boardId と GET /boards/:boardId/threads に分離済み)
export async function getBoardThreads(boardId: string): Promise<BoardThreadsResponse> {
  const [boardRes, threadsRes] = await Promise.all([
    getBoard(boardId),
    getThreads(boardId, { limit: 100 }),
  ])
  return { data: { board: boardRes.data, threads: threadsRes.data } }
}

export type CreateBoardInput = InferRequestType<typeof client.boards.$post>['json']

export async function createBoard(input: CreateBoardInput) {
  requireSession()
  requireTurnstileSession()
  return unwrap<ApiResponse<Board>>(client.boards.$post({ json: input }))
}

export async function deleteBoard(boardId: string) {
  requireTurnstileSession()
  return unwrap<void>(client.boards[':boardId'].$delete({ param: { boardId } }))
}
