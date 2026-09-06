import { apiFetch } from './client'
import type { LoginResponse, TurnstileResponse, Profile, ApiResponse } from './types'

export async function postTurnstile(token: string) {
  return apiFetch<ApiResponse<TurnstileResponse>>('/auth/turnstile', {
    method: 'POST',
    body: { token },
  })
}

export async function postLogin(id: string, password: string) {
  return apiFetch<ApiResponse<LoginResponse>>('/auth/login', {
    method: 'POST',
    body: { id, password },
    requiresTurnstile: true,
  })
}

export async function postLogout() {
  return apiFetch<void>('/auth/logout', {
    method: 'POST',
    requiresSession: true,
  })
}

export interface RegisterInput {
  id: string
  displayName: string
  password: string
}

export async function postRegister(input: RegisterInput) {
  return apiFetch<ApiResponse<Profile>>('/identity/users', {
    method: 'POST',
    body: input,
    requiresTurnstile: true,
  })
}
