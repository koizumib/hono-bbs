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
