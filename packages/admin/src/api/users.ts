import type { InferRequestType } from 'hono/client'
import { client, unwrap, requireSession, requireTurnstileSession } from './rpcClient'
import type { User, UsersResponse, ApiResponse } from './types'

// pageベースのページネーション (board/thread/postのlimit/cursor方式とは別方式)
export async function getUsers(page = 1) {
  requireSession()
  return unwrap<UsersResponse>(client.identity.users.$get({ query: { page: String(page) } }))
}

export async function getUser(id: string) {
  requireSession()
  return unwrap<ApiResponse<User>>(client.identity.users[':id'].$get({ param: { id } }))
}

export type UpdateUserInput = InferRequestType<(typeof client.identity.users)[':id']['$put']>['json']

export async function updateUser(id: string, input: UpdateUserInput) {
  requireSession()
  requireTurnstileSession()
  return unwrap<ApiResponse<User>>(client.identity.users[':id'].$put({ param: { id }, json: input }))
}

export async function deleteUser(id: string) {
  requireSession()
  requireTurnstileSession()
  return unwrap<void>(client.identity.users[':id'].$delete({ param: { id } }))
}
