import { client, unwrap } from './rpcClient'
import type { ApiResponse, LoginResponse } from './types'

export async function login(id: string, password: string) {
  return unwrap<ApiResponse<LoginResponse>>(client.auth.login.$post({ json: { id, password } }))
}

export async function logout() {
  return unwrap<void>(client.auth.logout.$post({}))
}
