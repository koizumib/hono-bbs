import { apiFetch } from './client'
import type { ApiResponse } from './types'

// popular-threads は今回のRPC化(hc<AppType>())のスコープ外 (auth/identity/profile等と同様)
// なので、手書きのapiFetchで叩く。
export interface PopularThreadEntry {
  boardId: string
  boardName: string
  threadId: string
  title: string
  postCount: number
  momentum: number
  createdAt: string
  opAuthorId: string | null
  opPosterName: string
  opPosterOptionInfo: string
  opContent: string
}

export interface PopularThreadsSnapshot {
  computedAt: string
  items: PopularThreadEntry[]
}

export async function getPopularThreads() {
  return apiFetch<ApiResponse<PopularThreadsSnapshot>>('/popular-threads')
}
