import { apiFetch } from './client'
import type { Post, ThreadPostsResponse, ApiResponse } from './types'

export async function getThreadPosts(boardId: string, threadId: string) {
  return apiFetch<ThreadPostsResponse>(`/boards/${boardId}/${threadId}`)
}

export interface CreatePostInput {
  content: string
  posterName?: string
  posterOptionInfo?: string
}

export async function createPost(boardId: string, threadId: string, input: CreatePostInput) {
  return apiFetch<ApiResponse<Post>>(`/boards/${boardId}/${threadId}`, {
    method: 'POST',
    body: input,
    requiresTurnstile: true,
  })
}

export async function softDeletePost(boardId: string, threadId: string, responseNumber: number) {
  return apiFetch<ApiResponse<Post>>(`/boards/${boardId}/${threadId}/${responseNumber}`, {
    method: 'DELETE',
    requiresTurnstile: true,
  })
}
