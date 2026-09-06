import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { postRegister, postLogin } from '../api/auth'
import { useAuthStore } from '../stores/authStore'
import { useTurnstileStore } from '../stores/turnstileStore'
import { ApiError, TurnstileRequiredError } from '../api/client'
import { env } from '../config/env'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [id, setId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isTurnstileError, setIsTurnstileError] = useState(false)

  const setSession = useAuthStore((s) => s.setSession)
  const turnstileValid = useTurnstileStore((s) => s.isValid())
  const setTurnstileSession = useTurnstileStore((s) => s.setSession)

  const mutation = useMutation({
    mutationFn: async () => {
      // POST /identity/users でユーザー登録してから自動ログイン
      await postRegister({ id, displayName, password })
      return postLogin(id, password)
    },
    onSuccess: (res) => {
      setSession(res.data.sessionId, res.data.userId, res.data.displayName, res.data.expiresAt)
      navigate('/')
    },
    onError: (err) => {
      if (err instanceof TurnstileRequiredError) {
        setIsTurnstileError(true)
        setError('turnstile')
      } else {
        setIsTurnstileError(false)
        if (err instanceof ApiError) {
          setError(err.message)
        } else {
          setError('登録に失敗しました')
        }
      }
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsTurnstileError(false)

    if (password !== passwordConfirm) {
      setError('パスワードが一致しません')
      return
    }
    if (env.disableTurnstile && !turnstileValid) {
      setTurnstileSession('dev-turnstile-disabled')
    }
    mutation.mutate()
  }

  const turnstileReturnTo = encodeURIComponent(window.location.href)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-c-surface border border-c-border rounded-2xl p-8 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-slate-900 dark:text-white font-bold text-lg">新規アカウント登録</h2>
          <button
            onClick={() => navigate('/')}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
              ユーザーID
            </label>
            <input
              type="text"
              value={id}
              onChange={(e) => setId(e.target.value)}
              className="w-full bg-c-surface2 border border-c-border rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-c-accent/50 text-sm"
              placeholder="ログインIDを入力"
              required
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
              表示名
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-c-surface2 border border-c-border rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-c-accent/50 text-sm"
              placeholder="表示名を入力"
              required
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
              パスワード
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-c-surface2 border border-c-border rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-c-accent/50 text-sm"
              placeholder="パスワードを入力"
              required
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
              パスワード（確認）
            </label>
            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              className="w-full bg-c-surface2 border border-c-border rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-c-accent/50 text-sm"
              placeholder="パスワードを再入力"
              required
            />
          </div>

          {error && (
            <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {isTurnstileError && !env.disableTurnstile && env.turnstileTokenUrl ? (
                <span>
                  <a
                    href={`${env.turnstileTokenUrl}?returnTo=${turnstileReturnTo}`}
                    className="underline font-medium hover:text-red-300"
                  >
                    Turnstile
                  </a>
                  セッションが必要です
                </span>
              ) : (
                error
              )}
            </p>
          )}

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full py-3 bg-c-accent hover:bg-[var(--c-accent-hover)] disabled:opacity-50 text-[var(--c-accent-text)] font-bold rounded-xl transition-all text-sm"
          >
            {mutation.isPending ? '登録中...' : '登録する'}
          </button>

          <p className="text-center text-xs text-slate-500">
            すでにアカウントをお持ちの方は{' '}
            <button
              type="button"
              onClick={() => navigate('/')}
              className="text-c-accent hover:underline"
            >
              ログイン
            </button>
          </p>
        </form>
      </div>
    </div>
  )
}
