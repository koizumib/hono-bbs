import { env } from '../config/env'
import { useAuthStore } from '../stores/authStore'
import { useTurnstileStore } from '../stores/turnstileStore'

export class ApiError extends Error {
  readonly code: string
  readonly status: number
  readonly errorCodes?: string[]

  constructor(code: string, message: string, status: number, errorCodes?: string[]) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.errorCodes = errorCodes
  }
}

export class TurnstileRequiredError extends Error {
  constructor() {
    super('Turnstile session required')
    this.name = 'TurnstileRequiredError'
  }
}

interface FetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  requiresTurnstile?: boolean
  requiresSession?: boolean
}

export async function apiFetch<T>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const { method = 'GET', body, requiresTurnstile = false, requiresSession = false } = options

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  const sessionId = useAuthStore.getState().sessionId
  if (sessionId) {
    headers['X-Session-Id'] = sessionId
  } else if (requiresSession) {
    throw new ApiError('UNAUTHORIZED', '未ログインです', 401)
  }

  const turnstileSessionId = useTurnstileStore.getState().sessionId
  if (turnstileSessionId) {
    headers['X-Turnstile-Session'] = turnstileSessionId
  } else if (requiresTurnstile) {
    throw new TurnstileRequiredError()
  }

  const url = `${env.apiBaseUrl}${env.apiBasePath}${path}`

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 204) {
    return undefined as T
  }

  const json = await res.json()

  if (!res.ok) {
    throw new ApiError(
      json.error ?? 'UNKNOWN_ERROR',
      json.message ?? 'エラーが発生しました',
      res.status,
      json.errorCodes,
    )
  }

  return json as T
}
