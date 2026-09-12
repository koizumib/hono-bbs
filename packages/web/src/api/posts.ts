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

// スレッド情報と投稿一覧を取得し、旧APIと同じ形にまとめる
// (バックエンドは GET .../threads/:threadId と GET .../threads/:threadId/posts に分離済み)。
// posts側は1ページ最大100件のカーソルページネーションなので、レス数が100を超える
// スレッドでも全レスを表示できるよう、nextCursorがなくなるまで全ページを取得する
// (以前は1ページ目だけ取得していたため、100レスを超えた分が画面に出ない不具合があった)。
export async function getThreadPosts(boardId: string, threadId: string): Promise<ThreadPostsResponse> {
  const threadPromise = getThread(boardId, threadId)
  const posts: Post[] = []
  let cursor: string | undefined
  for (;;) {
    const page = await getPosts(boardId, threadId, { limit: 100, cursor })
    posts.push(...page.data)
    if (!page.nextCursor) break
    cursor = page.nextCursor
  }
  const threadRes = await threadPromise
  return { data: { thread: threadRes.data, posts } }
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
