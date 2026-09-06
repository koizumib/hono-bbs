import { ApiError } from '../api/client'

export default function ErrorBanner({ error }: { error: unknown }) {
  if (!error) return null
  const message = error instanceof ApiError ? error.message : error instanceof Error ? error.message : String(error)
  return (
    <div className="rounded border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm text-red-300">
      {message}
    </div>
  )
}
