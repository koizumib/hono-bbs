import type { InferRequestType } from 'hono/client'
import { client, unwrap, requireSession, requireTurnstileSession } from './rpcClient'
import { getThreads } from './threads'
import type { Board, BoardsResponse, BoardThreadsResponse, ApiResponse, Thread } from './types'

export async function getBoards(params?: { limit?: number; cursor?: string }) {
  return unwrap<BoardsResponse>(client.boards.$get({ query: {
    limit: params?.limit !== undefined ? String(params.limit) : undefined,
    cursor: params?.cursor,
  } }))
}

export async function getBoard(boardId: string) {
  return unwrap<ApiResponse<Board>>(client.boards[':boardId'].$get({ param: { boardId } }))
}

// 板情報とスレッド一覧を取得し、旧APIと同じ形にまとめる
// (バックエンドは GET /boards/:boardId と GET /boards/:boardId/threads に分離済み)。
// threads側は1ページ最大100件のカーソルページネーションなので、アクティブなスレッドが
// 100件を超える板でも一覧に全スレッドが出るよう、nextCursorがなくなるまで全ページ取得する
// (以前は1ページ目だけ取得していたため、101件目以降のスレッドが一覧に出ない不具合があった)。
export async function getBoardThreads(boardId: string): Promise<BoardThreadsResponse> {
  const boardPromise = getBoard(boardId)
  const threads: Thread[] = []
  let cursor: string | undefined
  for (;;) {
    const page = await getThreads(boardId, { limit: 100, cursor })
    threads.push(...page.data)
    if (!page.nextCursor) break
    cursor = page.nextCursor
  }
  const boardRes = await boardPromise
  return { data: { board: boardRes.data, threads } }
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
