import { ApiError, TurnstileRequiredError } from '../api/client'
import { env } from '../config/env'

function TurnstileErrorMessage() {
  const returnTo = encodeURIComponent(window.location.href)
  if (!env.turnstileTokenUrl) {
    return <span>Turnstileセッションが必要です。ページを再読み込みしてください。</span>
  }
  return (
    <span>
      <a
        href={`${env.turnstileTokenUrl}?returnTo=${returnTo}`}
        className="underline font-medium hover:text-red-100"
      >
        Turnstile認証する
      </a>
      と操作できるようになります。
    </span>
  )
}

export default function ErrorBanner({ error }: { error: unknown }) {
  if (!error) return null
  if (error instanceof TurnstileRequiredError) {
    return (
      <div className="rounded border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm text-red-300">
        <TurnstileErrorMessage />
      </div>
    )
  }
  const message = error instanceof ApiError ? error.message : error instanceof Error ? error.message : String(error)
  return (
    <div className="rounded border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm text-red-300">
      {message}
    </div>
  )
}
