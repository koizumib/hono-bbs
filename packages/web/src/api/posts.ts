import type { InferRequestType } from 'hono/client'
import { client, unwrap, requireTurnstileSession } from './rpcClient'
import { getThread } from './threads'
import type { Post, PostsResponse, ThreadPostsResponse, ApiResponse } from './types'

export async function getPosts(boardId: string, threadId: string, params?: { limit?: number; cursor?: string }) {
  return unwrap<PostsResponse>(client.boards[':boardId'].threads[':threadId'].posts.$get({
    param: { boardId, threadId },
    query: {
      limit: params?.limit !== undefined ? String(params.limit) : undefined,
      cursor: params?.cursor,
    },
  }))
}

// スレッド情報と投稿一覧を2リクエストで並列取得し、旧APIと同じ形にまとめる
// (バックエンドは GET .../threads/:threadId と GET .../threads/:threadId/posts に分離済み)
export async function getThreadPosts(boardId: string, threadId: string): Promise<ThreadPostsResponse> {
  const [threadRes, postsRes] = await Promise.all([
    getThread(boardId, threadId),
    getPosts(boardId, threadId, { limit: 100 }),
  ])
  return { data: { thread: threadRes.data, posts: postsRes.data } }
}

export type CreatePostInput = InferRequestType<
  (typeof client.boards)[':boardId']['threads'][':threadId']['posts']['$post']
>['json']

export async function createPost(boardId: string, threadId: string, input: CreatePostInput) {
  requireTurnstileSession()
  return unwrap<ApiResponse<Post>>(client.boards[':boardId'].threads[':threadId'].posts.$post({ param: { boardId, threadId }, json: input }))
}

export async function softDeletePost(boardId: string, threadId: string, postNumber: number) {
  requireTurnstileSession()
  return unwrap<void>(client.boards[':boardId'].threads[':threadId'].posts[':postNumber'].$delete({
    param: { boardId, threadId, postNumber: String(postNumber) },
  }))
}

export async function reportPost(boardId: string, threadId: string, postNumber: number) {
  requireTurnstileSession()
  return unwrap<ApiResponse<{ message: string }>>(
    client.boards[':boardId'].threads[':threadId'].posts[':postNumber'].report.$post({
      param: { boardId, threadId, postNumber: String(postNumber) },
    }),
  )
}
