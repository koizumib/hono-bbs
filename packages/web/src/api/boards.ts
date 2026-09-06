import { apiFetch } from './client'
import type { Board, BoardsResponse, BoardThreadsResponse, ApiResponse, ResourceAcl } from './types'

export async function getBoards() {
  return apiFetch<BoardsResponse>('/boards')
}

export async function getBoardThreads(boardId: string) {
  return apiFetch<BoardThreadsResponse>(`/boards/${boardId}`)
}

export interface CreateBoardInput {
  id?: string
  name: string
  description?: string | null
  acl?: Omit<ResourceAcl, 'ownerUserId'>
  category?: string
}

export async function createBoard(input: CreateBoardInput) {
  return apiFetch<ApiResponse<Board>>('/boards', {
    method: 'POST',
    body: input,
    requiresTurnstile: true,
    requiresSession: true,
  })
}

export async function deleteBoard(boardId: string) {
  return apiFetch<void>(`/boards/${boardId}`, {
    method: 'DELETE',
    requiresTurnstile: true,
  })
}
