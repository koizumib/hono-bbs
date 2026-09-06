export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
  apiBasePath: import.meta.env.VITE_API_BASE_PATH ?? '/api/v1',
  disableTurnstile: import.meta.env.VITE_DISABLE_TURNSTILE === 'true',
  turnstileTokenUrl: import.meta.env.VITE_TURNSTILE_TOKEN_URL ?? '',
} as const
