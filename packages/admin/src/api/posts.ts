import type { InferRequestType } from 'hono/client'
import { client, unwrap, requireSession, requireTurnstileSession } from './rpcClient'
import type { Post, PostsResponse, ApiResponse } from './types'

export async function getPosts(boardId: string, threadId: string, params?: { limit?: number; cursor?: string }) {
  return unwrap<PostsResponse>(client.boards[':boardId'].threads[':threadId'].posts.$get({
    param: { boardId, threadId },
    query: {
      limit: params?.limit !== undefined ? String(params.limit) : undefined,
      cursor: params?.cursor,
    },
  }))
}

export type PatchPostInput = InferRequestType<
  (typeof client.boards)[':boardId']['threads'][':threadId']['posts'][':postNumber']['$patch']
>['json']

// PATCH: ACLのみ変更可能 (content等は編集不可)
export async function patchPost(boardId: string, threadId: string, postNumber: number, input: PatchPostInput) {
  requireSession()
  requireTurnstileSession()
  return unwrap<ApiResponse<Post>>(client.boards[':boardId'].threads[':threadId'].posts[':postNumber'].$patch({
    param: { boardId, threadId, postNumber: String(postNumber) },
    json: input,
  }))
}

// DELETE: ソフトデリート (isDeletedフラグが立つ。204を返す)
export async function deletePost(boardId: string, threadId: string, postNumber: number) {
  requireSession()
  requireTurnstileSession()
  return unwrap<void>(client.boards[':boardId'].threads[':threadId'].posts[':postNumber'].$delete({
    param: { boardId, threadId, postNumber: String(postNumber) },
  }))
}
