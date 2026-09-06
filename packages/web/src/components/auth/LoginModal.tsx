import { useState } from 'react'
import { postLogin, postRegister } from '../../api/auth'

import { useAuthStore } from '../../stores/authStore'
import { useTurnstileStore } from '../../stores/turnstileStore'
import { ApiError, TurnstileRequiredError } from '../../api/client'
import { env } from '../../config/env'

function TurnstileLoginError() {
  const returnTo = encodeURIComponent(window.location.href)
  return (
    <span>
      <a
        href={`${env.turnstileTokenUrl}?returnTo=${returnTo}`}
        className="underline font-medium hover:text-red-300"
      >
        Turnstile
      </a>
      セッションが必要です。ページを再読み込みしてください。
    </span>
  )
}

interface LoginModalProps {
  onClose: () => void
}

export default function LoginModal({ onClose }: LoginModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login')

  // Login state
  const [id, setId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isTurnstileError, setIsTurnstileError] = useState(false)
  const [loading, setLoading] = useState(false)

  // Register state
  const [regId, setRegId] = useState('')
  const [regDisplayName, setRegDisplayName] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('')
  const [regError, setRegError] = useState<string | null>(null)
  const [regIsTurnstileError, setRegIsTurnstileError] = useState(false)
  const [regLoading, setRegLoading] = useState(false)

  const setSession = useAuthStore((s) => s.setSession)
  const turnstileValid = useTurnstileStore((s) => s.isValid())
  const setTurnstileSession = useTurnstileStore((s) => s.setSession)

  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // 開発環境ではTurnstileをスキップ
    if (env.disableTurnstile && !turnstileValid) {
      setTurnstileSession('dev-turnstile-disabled')
    }

    try {
      const res = await postLogin(id, password)
      setSession(res.data.sessionId, res.data.userId, res.data.displayName, res.data.expiresAt)
      onClose()
    } catch (err) {
      if (err instanceof TurnstileRequiredError) {
        setIsTurnstileError(true)
        setError('turnstile')
      } else if (err instanceof ApiError) {
        if (err.code === 'INVALID_CREDENTIALS') {
          setError('IDまたはパスワードが正しくありません')
        } else {
          setError(err.message)
        }
      } else {
        setError('ログインに失敗しました')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleRegisterSubmit(e: React.FormEvent) {
    e.preventDefault()
    setRegError(null)

    if (regPassword !== regPasswordConfirm) {
      setRegError('パスワードが一致しません')
      return
    }

    setRegLoading(true)

    if (env.disableTurnstile && !turnstileValid) {
      setTurnstileSession('dev-turnstile-disabled')
    }

    try {
      // POST /identity/users でユーザー登録
      await postRegister({ id: regId, displayName: regDisplayName, password: regPassword })
      // 登録成功後に自動ログイン
      const loginRes = await postLogin(regId, regPassword)
      setSession(loginRes.data.sessionId, loginRes.data.userId, loginRes.data.displayName, loginRes.data.expiresAt)
      onClose()
    } catch (err) {
      if (err instanceof TurnstileRequiredError) {
        setRegIsTurnstileError(true)
        setRegError('turnstile')
      } else if (err instanceof ApiError) {
        setRegError(err.message)
      } else {
        setRegError('登録に失敗しました')
      }
    } finally {
      setRegLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#161920] border border-slate-800 rounded-2xl p-8 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white font-bold text-lg">
            {mode === 'login' ? 'ログイン' : 'アカウント登録'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {mode === 'login' ? (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                ユーザーID
              </label>
              <input
                type="text"
                value={id}
                onChange={(e) => setId(e.target.value)}
                className="w-full bg-[#1a1d24] border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600/50 text-sm"
                placeholder="ユーザーIDを入力"
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
                className="w-full bg-[#1a1d24] border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600/50 text-sm"
                placeholder="パスワードを入力"
                required
              />
            </div>

            {error && (
              <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {isTurnstileError && !env.disableTurnstile && env.turnstileTokenUrl ? (
                  <TurnstileLoginError />
                ) : (
                  error
                )}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-c-accent text-[var(--c-accent-text)] hover:opacity-90 disabled:opacity-50 font-bold rounded-xl transition-all text-sm"
            >
              {loading ? 'ログイン中...' : 'ログイン'}
            </button>
            <p className="text-center text-xs text-slate-400 mt-2">
              アカウントをお持ちでない方は{' '}
              <button
                type="button"
                onClick={() => setMode('register')}
                className="text-blue-400 hover:underline"
              >
                新規登録
              </button>
            </p>
          </form>
        ) : (
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                ユーザーID
              </label>
              <input
                type="text"
                value={regId}
                onChange={(e) => setRegId(e.target.value)}
                className="w-full bg-[#1a1d24] border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-c-accent/50 text-sm"
                placeholder="ユーザーIDを入力"
                required
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                表示名
              </label>
              <input
                type="text"
                value={regDisplayName}
                onChange={(e) => setRegDisplayName(e.target.value)}
                className="w-full bg-[#1a1d24] border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-c-accent/50 text-sm"
                placeholder="表示名を入力"
                required
              />
              <p className="text-[10px] text-slate-500 mt-1">日本語可・0〜128文字。省略時はIDと同じになります。</p>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                パスワード
              </label>
              <input
                type="password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                className="w-full bg-[#1a1d24] border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-c-accent/50 text-sm"
                placeholder="パスワードを入力"
                required
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                パスワード確認
              </label>
              <input
                type="password"
                value={regPasswordConfirm}
                onChange={(e) => setRegPasswordConfirm(e.target.value)}
                className="w-full bg-[#1a1d24] border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-c-accent/50 text-sm"
                placeholder="パスワードを再入力"
                required
              />
            </div>

            {regError && (
              <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {regIsTurnstileError && !env.disableTurnstile && env.turnstileTokenUrl ? (
                  <TurnstileLoginError />
                ) : (
                  regError
                )}
              </p>
            )}

            <button
              type="submit"
              disabled={regLoading}
              className="w-full py-3 bg-c-accent text-[var(--c-accent-text)] hover:opacity-90 disabled:opacity-50 font-bold rounded-xl transition-all text-sm"
            >
              {regLoading ? '登録中...' : '登録する'}
            </button>
            <p className="text-center text-xs text-slate-400 mt-2">
              すでにアカウントをお持ちの方は{' '}
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-blue-400 hover:underline"
              >
                ログインに戻る
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
