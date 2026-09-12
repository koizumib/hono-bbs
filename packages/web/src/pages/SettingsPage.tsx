import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useIsMobile } from '../hooks/useIsMobile'
import { useQuery, useMutation } from '@tanstack/react-query'
import { getProfile, updateProfile, deleteProfile } from '../api/profile'
import { useAuthStore } from '../stores/authStore'
import { useSettingsStore } from '../stores/settingsStore'
import type { ColorScheme, DesignPattern, FontSize } from '../stores/settingsStore'
import Toggle from '../components/ui/Toggle'
import NgRuleManager from '../components/settings/NgRuleManager'
import { useTurnstileStore } from '../stores/turnstileStore'
import { env } from '../config/env'
import { getHistory, clearHistory } from '../utils/threadHistory'
import { getPostHistory, clearPostHistory } from '../utils/postHistory'
import { getImageHistory, removeImageFromHistory, clearImageHistory } from '../utils/imageHistory'
import type { ImageHistoryEntry } from '../utils/imageHistory'
import { deleteImage } from '../api/imageUploader'
import { formatDistanceToNow } from 'date-fns'
import { ja } from 'date-fns/locale'


type TabType = 'account' | 'preferences' | 'history' | 'posts' | 'images' | 'terms'

export default function SettingsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState<TabType>(() => {
    const t = searchParams.get('tab')
    if (t === 'account' || t === 'preferences' || t === 'history' || t === 'posts' || t === 'images' || t === 'terms') return t
    return 'account'
  })
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn())
  const clearSession = useAuthStore((s) => s.clearSession)
  const {
    historyMaxGenerations,
    postHistoryMaxGenerations,
    defaultPosterName,
    defaultSubInfo,
    threadListAutoRefresh,
    threadListRefreshInterval,
    setHistoryMaxGenerations,
    setPostHistoryMaxGenerations,
    setDefaultPosterName,
    setDefaultSubInfo,
    setThreadListAutoRefresh,
    setThreadListRefreshInterval,
  } = useSettingsStore()
  const scheme = useSettingsStore((s) => s.scheme)
  const pattern = useSettingsStore((s) => s.pattern)
  const fontSize = useSettingsStore((s) => s.fontSize)
  const setScheme = useSettingsStore((s) => s.setScheme)
  const setPattern = useSettingsStore((s) => s.setPattern)
  const setFontSize = useSettingsStore((s) => s.setFontSize)
  const gestureSensitivity = useSettingsStore((s) => s.gestureSensitivity)
  const setGestureSensitivity = useSettingsStore((s) => s.setGestureSensitivity)
  const turnstileSessionId = useTurnstileStore((s) => s.sessionId)
  const setTurnstileSession = useTurnstileStore((s) => s.setSession)
  const clearTurnstileSession = useTurnstileStore((s) => s.clearSession)
  const [turnstileToken, setTurnstileToken] = useState(turnstileSessionId ?? '')
  const [turnstileSaved, setTurnstileSaved] = useState(false)
  const [historyEntries, setHistoryEntries] = useState(() => getHistory())
  const [postHistoryEntries, setPostHistoryEntries] = useState(() => getPostHistory())
  const [imageHistoryEntries, setImageHistoryEntries] = useState<ImageHistoryEntry[]>(() => getImageHistory())
  const [deletingImageIds, setDeletingImageIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    setTurnstileToken(turnstileSessionId ?? '')
  }, [turnstileSessionId])

  function handleSaveTurnstile() {
    if (turnstileToken.trim()) {
      setTurnstileSession(turnstileToken.trim())
    } else {
      clearTurnstileSession()
    }
    setTurnstileSaved(true)
    setTimeout(() => setTurnstileSaved(false), 2000)
  }

  function handleClearHistory() {
    clearHistory()
    setHistoryEntries([])
  }

  function handleClearPostHistory() {
    clearPostHistory()
    setPostHistoryEntries([])
  }

  async function handleDeleteImage(entry: ImageHistoryEntry) {
    setDeletingImageIds((prev) => new Set(prev).add(entry.imageId))
    try {
      await deleteImage(entry.imageId, entry.deleteToken)
    } catch {
      // サーバー側で既に削除済みの場合も履歴から除去する
    }
    removeImageFromHistory(entry.imageId)
    setImageHistoryEntries(getImageHistory())
    setDeletingImageIds((prev) => {
      const next = new Set(prev)
      next.delete(entry.imageId)
      return next
    })
  }

  function handleClearImageHistory() {
    clearImageHistory()
    setImageHistoryEntries([])
  }

  const { data: profileData } = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
    enabled: isLoggedIn,
  })

  const profile = profileData?.data
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName)
      setBio(profile.bio ?? '')
      setEmail(profile.email ?? '')
    }
  }, [profile])

  const updateMutation = useMutation({
    mutationFn: () => updateProfile({
      displayName,
      bio: bio || null,
      email: email || null,
      ...(currentPassword && newPassword ? { currentPassword, newPassword } : {}),
    }),
    onSuccess: () => {
      setCurrentPassword('')
      setNewPassword('')
      setNewPasswordConfirm('')
      setPasswordError(null)
      alert('設定を保存しました')
    },
    onError: () => alert('保存に失敗しました'),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteProfile,
    onSuccess: () => {
      clearSession()
      navigate('/')
    },
  })

  function handleDeleteAccount() {
    if (confirm('アカウントを削除しますか？この操作は取り消せません。')) {
      deleteMutation.mutate()
    }
  }

  const isMobile = useIsMobile()
  const mainRef = useRef<HTMLElement>(null)

  // タブ切り替え時にスクロール位置をリセット
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
  }, [tab])

  const TAB_LABELS: Record<TabType, { full: string; short: string }> = {
    account:     { full: 'アカウント',       short: 'アカ' },
    preferences: { full: '表示・書き込み設定', short: '設定' },
    history:     { full: '閲覧履歴',           short: '履歴' },
    posts:       { full: '投稿履歴',           short: '投稿' },
    images:      { full: '画像履歴',           short: '画像' },
    terms:       { full: '利用規約',           short: '規約' },
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-c-base text-slate-700 dark:text-slate-200">
      {/* PCでの左ナビ(ホーム/設定への導線・ログアウト)は常設のAppShell(トップバー+
          アイコンレール)が肩代わりするため、このページ独自のサイドバーは持たない */}

      {/* メインコンテンツ（タブバー固定 + スクロールエリア） */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* モバイル用トップバー */}
        {isMobile && (
          <header className="h-14 flex items-center px-2 gap-1 bg-c-surface border-b border-c-border flex-shrink-0">
            <button
              className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors flex-shrink-0"
              onClick={() => navigate('/')}
            >
              <span className="material-symbols-outlined text-2xl">arrow_back</span>
            </button>
            <span className="font-bold text-slate-900 dark:text-white text-sm">設定</span>
          </header>
        )}

        {/* タブヘッダー（常に表示・スクロールしない） */}
        <header className={`bg-c-base border-b border-c-border flex-shrink-0 ${isMobile ? '' : 'px-8'}`}>
          <div className={`flex ${isMobile ? 'gap-0' : 'gap-8'}`}>
            {(['account', 'preferences', 'history', 'posts', 'images', 'terms'] as TabType[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`${isMobile ? 'flex-1 py-3 text-xs' : 'py-4 text-sm'} border-b-2 font-medium transition-colors ${
                  tab === t
                    ? 'border-c-accent text-c-accent font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {isMobile ? TAB_LABELS[t].short : TAB_LABELS[t].full}
              </button>
            ))}
          </div>
        </header>

        {/* スクロールエリア */}
        <main ref={mainRef} className="flex-1 overflow-y-auto custom-scrollbar">
        <div className={isMobile ? 'px-3 py-4 space-y-6' : 'max-w-4xl w-full mx-auto p-8 space-y-10'}>
          {tab === 'account' && (
            <>
              {/* プロフィールセクション */}
              {profile && (
                <section className="bg-c-surface p-8 rounded-2xl border border-c-border flex flex-col md:flex-row items-center gap-8 shadow-xl shadow-black/5">
                  <div className="relative">
                    <div className="w-28 h-28 rounded-full bg-c-accent/10 flex items-center justify-center overflow-hidden border-2 border-c-accent/30">
                      <span className="text-4xl font-bold text-c-accent">
                        {profile.displayName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div className="text-center md:text-left space-y-2">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{profile.displayName}</h2>
                    <div className="flex items-center justify-center md:justify-start gap-3">
                      <span className="px-2.5 py-0.5 bg-c-accent/20 text-c-accent text-xs font-bold rounded uppercase tracking-wider">
                        一般会員
                      </span>
                      <span className="text-sm text-slate-500 font-mono">ID: {profile.id}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-2 flex items-center justify-center md:justify-start gap-1">
                      <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                      登録日: {new Date(profile.createdAt).toLocaleDateString('ja-JP')}
                    </p>
                  </div>
                </section>
              )}

              {/* プロフィール編集 */}
              {isLoggedIn && (
                <section className="space-y-6">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-3">
                    <span className="material-symbols-outlined text-c-accent">edit</span>
                    プロフィール編集
                  </h3>
                  <div className="bg-c-surface p-6 rounded-2xl border border-c-border space-y-4">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        表示名
                      </label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full bg-c-surface2 border border-c-border rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-c-accent/50 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        自己紹介
                      </label>
                      <textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        className="w-full bg-c-surface2 border border-c-border rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-c-accent/50 text-sm resize-none h-24 custom-scrollbar"
                        placeholder="自己紹介を入力..."
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        メールアドレス
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-c-surface2 border border-c-border rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-c-accent/50 text-sm"
                        placeholder="メールアドレスを入力..."
                      />
                    </div>
                    {/* パスワード変更 */}
                    <div className="border-t border-c-border pt-4 mt-2">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">パスワード変更（変更する場合のみ入力）</p>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                            現在のパスワード
                          </label>
                          <input
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="w-full bg-c-surface2 border border-c-border rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-c-accent/50 text-sm"
                            placeholder="現在のパスワードを入力..."
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                            新しいパスワード
                          </label>
                          <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full bg-c-surface2 border border-c-border rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-c-accent/50 text-sm"
                            placeholder="新しいパスワード（8文字以上）..."
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                            新しいパスワード（確認）
                          </label>
                          <input
                            type="password"
                            value={newPasswordConfirm}
                            onChange={(e) => setNewPasswordConfirm(e.target.value)}
                            className="w-full bg-c-surface2 border border-c-border rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-c-accent/50 text-sm"
                            placeholder="新しいパスワードを再入力..."
                          />
                        </div>
                      </div>
                      {passwordError && (
                        <p className="text-red-400 text-xs mt-2">{passwordError}</p>
                      )}
                    </div>
                  </div>

                  {/* 保存ボタン（プロフィール編集フォームの直下に置く。この下の項目は変更が自動保存される） */}
                  <div className="flex justify-end gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        if (profile) {
                          setDisplayName(profile.displayName)
                          setBio(profile.bio ?? '')
                          setEmail(profile.email ?? '')
                        }
                        setCurrentPassword('')
                        setNewPassword('')
                        setNewPasswordConfirm('')
                        setPasswordError(null)
                      }}
                      className="px-8 py-2.5 border border-c-border bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl text-sm font-bold transition-all"
                    >
                      キャンセル
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPasswordError(null)
                        if (newPassword || currentPassword) {
                          if (newPassword !== newPasswordConfirm) {
                            setPasswordError('新しいパスワードが一致しません')
                            return
                          }
                          if (!currentPassword) {
                            setPasswordError('現在のパスワードを入力してください')
                            return
                          }
                        }
                        updateMutation.mutate()
                      }}
                      disabled={updateMutation.isPending}
                      className="px-10 py-2.5 bg-c-accent hover:opacity-90 text-[var(--c-accent-text)] rounded-xl text-sm font-bold shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-sm">save</span>
                      プロフィールを保存
                    </button>
                  </div>
                </section>
              )}

              {/* Turnstileトークン設定 */}
              {!env.disableTurnstile && (
                <section className="space-y-6">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-3">
                    <span className="material-symbols-outlined text-c-accent">verified_user</span>
                    Turnstileトークン設定
                  </h3>
                  <div className="bg-c-surface p-6 rounded-2xl border border-c-border space-y-4">
                    <div className="bg-c-accent/10 border border-c-accent/20 rounded-xl p-4 flex items-start gap-3">
                      <span className="material-symbols-outlined text-c-accent flex-shrink-0 text-xl mt-0.5">info</span>
                      <div className="space-y-1.5">
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                          書き込み・ログイン・登録・プロフィール更新に必要なセッショントークンです。
                        </p>
                        {env.turnstileTokenUrl && (
                          <p className="text-sm text-slate-700 dark:text-slate-300">
                            以下のページでトークンを取得してください（現在のタブで遷移します）:{' '}
                            <a
                              href={`${env.turnstileTokenUrl}?returnTo=${encodeURIComponent(window.location.href)}`}
                              className="text-blue-500 hover:underline font-medium"
                            >
                              Turnstile トークン取得
                            </a>
                          </p>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        トークン
                      </label>
                      <input
                        type="text"
                        value={turnstileToken}
                        onChange={(e) => setTurnstileToken(e.target.value)}
                        placeholder="取得したトークンを貼り付け..."
                        className="w-full bg-c-surface2 border border-c-border rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-c-accent/50 text-sm font-mono"
                      />
                      <p className="text-[11px] text-slate-500 mt-1.5">
                        トークンはこのブラウザに保存されます（有効期間: 30日）
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleSaveTurnstile}
                        className="px-5 py-2 bg-c-accent hover:opacity-90 text-[var(--c-accent-text)] rounded-xl text-sm font-bold shadow-lg transition-all flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-sm">save</span>
                        保存
                      </button>
                      {turnstileSaved && (
                        <span className="text-sm text-green-400 flex items-center gap-1">
                          <span className="material-symbols-outlined text-base">check_circle</span>
                          保存しました
                        </span>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {/* Danger Zone */}
              {isLoggedIn && (
                <section className="space-y-6">
                  <h3 className="text-lg font-bold text-red-500 flex items-center gap-3">
                    <span className="material-symbols-outlined">warning</span>
                    危険な操作（Danger Zone）
                  </h3>
                  <div className="bg-red-500/5 border border-red-500/20 p-8 rounded-2xl space-y-4 shadow-lg shadow-red-950/5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div>
                        <p className="text-sm font-bold text-red-400">アカウントの削除</p>
                        <p className="text-xs text-slate-500 mt-1">
                          一度削除したアカウントとデータは復旧できません。
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleDeleteAccount}
                        disabled={deleteMutation.isPending}
                        className="px-6 py-2.5 bg-red-600/10 border border-red-600/30 hover:bg-red-600/20 text-red-500 text-sm font-bold rounded-xl transition-all disabled:opacity-50"
                      >
                        アカウントを削除
                      </button>
                    </div>
                  </div>
                </section>
              )}
            </>
          )}

          {tab === 'preferences' && (
            <>
              {/* スレッド一覧自動更新 */}
              <section className="space-y-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-3">
                  <span className="material-symbols-outlined text-c-accent">autorenew</span>
                  スレッド一覧 自動更新
                </h3>
                <div className="bg-c-surface p-6 rounded-2xl border border-c-border space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300">自動更新</p>
                      <p className="text-[10px] text-slate-500">スレッド一覧を定期的に自動更新します</p>
                    </div>
                    <Toggle checked={threadListAutoRefresh} onChange={setThreadListAutoRefresh} />
                  </div>
                  {threadListAutoRefresh && (
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        更新間隔（秒）
                      </label>
                      <input
                        type="number"
                        min={5}
                        value={threadListRefreshInterval}
                        onChange={(e) => {
                          const v = Math.max(5, Number(e.target.value))
                          setThreadListRefreshInterval(v)
                        }}
                        className="w-32 bg-c-surface2 border border-c-border rounded-xl px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-c-accent/50 text-sm"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">最小値: 5秒</p>
                    </div>
                  )}
                </div>
              </section>

              {/* デフォルト書き込み設定 */}
              <section className="space-y-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-3">
                  <span className="material-symbols-outlined text-c-accent">edit_note</span>
                  デフォルト書き込み設定
                </h3>
                <div className="bg-c-surface p-6 rounded-2xl border border-c-border space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      デフォルト投稿者名
                    </label>
                    <input
                      type="text"
                      value={defaultPosterName}
                      onChange={(e) => setDefaultPosterName(e.target.value)}
                      placeholder="（板のデフォルト名が使われます）"
                      className="w-full bg-c-surface2 border border-c-border rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-c-accent/50 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      デフォルトオプション欄
                    </label>
                    <input
                      type="text"
                      value={defaultSubInfo}
                      onChange={(e) => setDefaultSubInfo(e.target.value)}
                      placeholder="sage など"
                      className="w-full bg-c-surface2 border border-c-border rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-c-accent/50 text-sm"
                    />
                  </div>
                </div>
              </section>

              {/* NGワード設定 */}
              <section className="space-y-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-3">
                  <span className="material-symbols-outlined text-c-accent">filter_list</span>
                  NGワード・フィルタリング設定
                </h3>
                <NgRuleManager />
              </section>

              {/* カラースキーム */}
              <section className="space-y-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-3">
                  <span className="material-symbols-outlined text-c-accent">palette</span>
                  カラースキーム
                </h3>
                <div className="bg-c-surface p-6 rounded-2xl border border-c-border">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {([
                      { key: 'indigo' as ColorScheme, name: 'インディゴ', accent: '#7566e6', surface: '#12151b', border: '#242933', text: '#eef0f5' },
                      { key: 'amber-teal' as ColorScheme, name: 'アンバー×ティール', accent: '#e0993f', surface: '#171b26', border: '#2a3247', text: '#f2ece2' },
                      { key: 'indigo-light' as ColorScheme, name: 'インディゴ・ライト', accent: '#5b4bd6', surface: '#ffffff', border: '#e1e3ec', text: '#181a22' },
                      { key: 'amber-teal-light' as ColorScheme, name: 'アンバー×ティール・ライト', accent: '#b5691f', surface: '#ffffff', border: '#e8ddc7', text: '#241a0a' },
                    ]).map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => setScheme(s.key)}
                        className={`text-left rounded-xl border p-3 transition-colors ${
                          scheme === s.key ? 'border-c-accent ring-1 ring-c-accent' : 'border-c-border hover:border-c-border-strong'
                        }`}
                        style={{ background: s.surface }}
                      >
                        <div className="text-xs font-bold mb-2 truncate" style={{ color: s.text }}>{s.name}</div>
                        <div className="flex gap-1.5">
                          <span className="w-4 h-4 rounded" style={{ background: s.accent }} />
                          <span className="w-4 h-4 rounded" style={{ background: s.surface, boxShadow: `inset 0 0 0 1px ${s.border}` }} />
                          <span className="w-4 h-4 rounded" style={{ background: s.border }} />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              {/* デザインパターン */}
              <section className="space-y-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-3">
                  <span className="material-symbols-outlined text-c-accent">style</span>
                  デザインパターン
                </h3>
                <div className="bg-c-surface p-6 rounded-2xl border border-c-border">
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      { key: 'tonal' as DesignPattern, name: 'トーナルカード', desc: '背景の濃淡で階層を作る' },
                      { key: 'bordered' as DesignPattern, name: '枠線リスト', desc: '背景は付けず、輪郭線だけで区切る' },
                    ]).map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => setPattern(p.key)}
                        className={`text-left rounded-xl border p-4 transition-colors ${
                          pattern === p.key ? 'border-c-accent ring-1 ring-c-accent bg-c-accent/5' : 'border-c-border hover:border-c-border-strong'
                        }`}
                      >
                        <div className="text-sm font-bold text-slate-900 dark:text-white mb-1">{p.name}</div>
                        <div className="text-xs text-slate-500">{p.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              {/* フォントサイズ */}
              <section className="space-y-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-3">
                  <span className="material-symbols-outlined text-c-accent">text_fields</span>
                  フォントサイズ
                </h3>
                <div className="bg-c-surface p-6 rounded-2xl border border-c-border space-y-3">
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-slate-500 flex-shrink-0">小</span>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      step={1}
                      value={fontSize}
                      onChange={(e) => setFontSize(Number(e.target.value) as FontSize)}
                      className="flex-1"
                    />
                    <span className="text-xs text-slate-500 flex-shrink-0">大</span>
                  </div>
                  <div className="flex justify-between px-2">
                    {[1,2,3,4,5].map((n) => (
                      <span
                        key={n}
                        className={`text-[10px] ${fontSize === n ? 'text-c-accent font-bold' : 'text-slate-400'}`}
                      >
                        {n === 1 ? '極小' : n === 2 ? '小' : n === 3 ? '標準' : n === 4 ? '大' : '極大'}
                      </span>
                    ))}
                  </div>
                </div>
              </section>

              {/* ジェスチャー感度（スマホ） */}
              <section className="space-y-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-3">
                  <span className="material-symbols-outlined text-c-accent">swipe</span>
                  スワイプジェスチャーの感度
                </h3>
                <div className="bg-c-surface p-6 rounded-2xl border border-c-border space-y-3">
                  <p className="text-xs text-slate-500">
                    スマホでのスワイプ操作(戻る・進む・最上部/最下部へ移動 など)を、どれくらい小さな動きで反応させるかを設定します。
                  </p>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-slate-500 flex-shrink-0">鈍い</span>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      step={1}
                      value={gestureSensitivity}
                      onChange={(e) => setGestureSensitivity(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}
                      className="flex-1"
                    />
                    <span className="text-xs text-slate-500 flex-shrink-0">敏感</span>
                  </div>
                  <div className="flex justify-between px-2">
                    {[1,2,3,4,5].map((n) => (
                      <span
                        key={n}
                        className={`text-[10px] ${gestureSensitivity === n ? 'text-c-accent font-bold' : 'text-slate-400'}`}
                      >
                        {n === 1 ? '鈍い' : n === 2 ? 'やや鈍い' : n === 3 ? '標準' : n === 4 ? 'やや敏感' : '敏感'}
                      </span>
                    ))}
                  </div>
                </div>
              </section>

            </>
          )}

          {tab === 'history' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-3">
                  <span className="material-symbols-outlined text-c-accent">history</span>
                  閲覧履歴
                </h3>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500">保存件数:</label>
                    <input
                      type="number"
                      min={10}
                      max={1000}
                      value={historyMaxGenerations}
                      onChange={(e) => setHistoryMaxGenerations(Number(e.target.value))}
                      className="w-20 bg-c-surface2 border border-c-border rounded-lg px-2 py-1 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-c-accent/50"
                    />
                  </div>
                  {historyEntries.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearHistory}
                      className="px-3 py-1.5 text-xs font-bold text-red-500 border border-red-500/30 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      履歴をクリア
                    </button>
                  )}
                </div>
              </div>
              {historyEntries.length === 0 ? (
                <div className="text-slate-500 text-sm text-center py-16">閲覧履歴はありません</div>
              ) : (
                <div className="space-y-2">
                  {historyEntries.map((entry) => (
                    <button
                      key={`${entry.boardId}-${entry.threadId}`}
                      type="button"
                      onClick={() => navigate(`/${entry.boardId}/${entry.threadId}`)}
                      className="w-full text-left p-3 bg-c-surface border border-c-border rounded-xl hover:border-blue-500/40 hover:bg-blue-500/5 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate leading-snug">
                            {entry.threadTitle}
                          </p>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-slate-500">{entry.boardName}</span>
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              <span className="material-symbols-outlined text-sm leading-none">forum</span>
                              {entry.lastReadCount}件既読
                            </span>
                            {entry.scrollProgress !== undefined && (
                              <span className="text-xs text-slate-400 flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm leading-none">
                                  {entry.scrollProgress >= 0.95 ? 'check_circle' : 'play_circle'}
                                </span>
                                {entry.scrollProgress >= 0.95
                                  ? '読了'
                                  : `${Math.round(entry.scrollProgress * 100)}% 既読`}
                              </span>
                            )}
                          </div>
                          {/* スクロール進捗バー */}
                          {entry.scrollProgress !== undefined && (
                            <div className="h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.round(entry.scrollProgress * 100)}%`,
                                  background: entry.scrollProgress >= 0.95
                                    ? 'var(--c-accent)'
                                    : 'color-mix(in srgb, var(--c-accent) 60%, transparent)',
                                }}
                              />
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-slate-400 flex-shrink-0 mt-0.5">
                          {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true, locale: ja })}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'posts' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-3">
                  <span className="material-symbols-outlined text-c-accent">edit_note</span>
                  投稿履歴
                </h3>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500">保存件数:</label>
                    <input
                      type="number"
                      min={5}
                      max={500}
                      value={postHistoryMaxGenerations}
                      onChange={(e) => setPostHistoryMaxGenerations(Number(e.target.value))}
                      className="w-20 bg-c-surface2 border border-c-border rounded-lg px-2 py-1 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-c-accent/50"
                    />
                  </div>
                  {postHistoryEntries.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearPostHistory}
                      className="px-3 py-1.5 text-xs font-bold text-red-500 border border-red-500/30 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      履歴をクリア
                    </button>
                  )}
                </div>
              </div>
              {postHistoryEntries.length === 0 ? (
                <div className="text-slate-500 text-sm text-center py-16">投稿履歴はありません</div>
              ) : (
                <div className="space-y-2">
                  {postHistoryEntries.map((entry, i) => (
                    <div
                      key={i}
                      className="w-full text-left p-4 bg-c-surface border border-c-border rounded-xl"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${entry.type === 'thread' ? 'bg-c-accent/10 text-c-accent' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                              {entry.type === 'thread' ? 'スレ' : 'レス'}
                            </span>
                            <span className="text-xs text-slate-500 truncate">{entry.threadTitle}</span>
                          </div>
                          <p className="text-sm text-slate-700 dark:text-slate-300 truncate">{entry.contentSnippet}</p>
                        </div>
                        <span className="text-xs text-slate-400 flex-shrink-0">
                          {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true, locale: ja })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'images' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-3">
                  <span className="material-symbols-outlined text-c-accent">photo_library</span>
                  画像アップロード履歴
                </h3>
                {imageHistoryEntries.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearImageHistory}
                    className="px-3 py-1.5 text-xs font-bold text-red-500 border border-red-500/30 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    履歴をクリア
                  </button>
                )}
              </div>
              {!env.imageUploaderUrl ? (
                <div className="text-slate-500 text-sm text-center py-16">
                  画像アップローダーが設定されていません
                </div>
              ) : imageHistoryEntries.length === 0 ? (
                <div className="text-slate-500 text-sm text-center py-16">画像アップロード履歴はありません</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {imageHistoryEntries.map((entry) => (
                    <div
                      key={entry.imageId}
                      className="bg-c-surface border border-c-border rounded-xl overflow-hidden flex flex-col"
                    >
                      <div className="aspect-square bg-slate-100 dark:bg-slate-900 relative overflow-hidden">
                        <img
                          src={entry.url}
                          alt={entry.originalFilename ?? ''}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <div className="p-2 flex flex-col gap-1.5">
                        <p className="text-xs text-slate-600 dark:text-slate-400 truncate" title={entry.originalFilename ?? ''}>
                          {entry.originalFilename ?? '(名称不明)'}
                        </p>
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] text-slate-400">
                            {formatDistanceToNow(new Date(entry.uploadedAt), { addSuffix: true, locale: ja })}
                          </span>
                          {entry.size != null && (
                            <span className="text-[10px] text-slate-400">
                              {entry.size < 1024 * 1024
                                ? `${Math.round(entry.size / 1024)}KB`
                                : `${(entry.size / 1024 / 1024).toFixed(1)}MB`}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1.5 mt-0.5">
                          <a
                            href={entry.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 text-center text-[10px] font-bold py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-white transition-colors"
                          >
                            開く
                          </a>
                          <button
                            type="button"
                            onClick={() => handleDeleteImage(entry)}
                            disabled={deletingImageIds.has(entry.imageId)}
                            className="flex-1 text-[10px] font-bold py-1 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                          >
                            {deletingImageIds.has(entry.imageId) ? '削除中...' : '削除'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {tab === 'terms' && (
            <div className="space-y-8">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-3">
                <span className="material-symbols-outlined text-c-accent">gavel</span>
                利用規約
              </h3>
              <div className="bg-c-surface border border-c-border rounded-2xl p-8 text-sm text-slate-700 dark:text-slate-300 leading-relaxed space-y-6">
                <p className="text-xs text-slate-500">最終更新日：2025年1月1日</p>

                <section className="space-y-2">
                  <h4 className="font-bold text-slate-900 dark:text-white">第1条（禁止事項）</h4>
                  <p>以下の行為を禁止します。</p>
                  <ul className="list-disc ml-5 space-y-1 text-slate-600 dark:text-slate-400">
                    <li>他者への誹謗中傷・脅迫・ハラスメント行為</li>
                    <li>個人情報（氏名・住所・電話番号など）の無断公開</li>
                    <li>違法コンテンツおよび著作権を侵害するコンテンツの投稿</li>
                    <li>スパム・荒らし・連続投稿などの妨害行為</li>
                    <li>わいせつ・暴力的・差別的な表現の投稿</li>
                    <li>その他、法令または公序良俗に反する行為</li>
                  </ul>
                </section>

                <section className="space-y-2">
                  <h4 className="font-bold text-slate-900 dark:text-white">第2条（匿名性について）</h4>
                  <ul className="list-disc ml-5 space-y-1 text-slate-600 dark:text-slate-400">
                    <li>投稿は匿名で行われますが、サーバー側で識別用IDが自動生成されます。</li>
                    <li>違法行為が確認された場合、法的手続きに基づき関連情報が開示されることがあります。</li>
                    <li>投稿したIPアドレスおよびアクセスログは一定期間保存されます。</li>
                  </ul>
                </section>

                <section className="space-y-2">
                  <h4 className="font-bold text-slate-900 dark:text-white">第3条（コンテンツの管理）</h4>
                  <ul className="list-disc ml-5 space-y-1 text-slate-600 dark:text-slate-400">
                    <li>管理者は利用規約に違反するコンテンツを予告なく削除または修正できます。</li>
                    <li>一度投稿した内容は、管理者への依頼なしには削除・編集できない場合があります。</li>
                    <li>管理者の判断により、アカウントの停止・アクセス制限を行う場合があります。</li>
                  </ul>
                </section>

                <section className="space-y-2">
                  <h4 className="font-bold text-slate-900 dark:text-white">第4条（免責事項）</h4>
                  <ul className="list-disc ml-5 space-y-1 text-slate-600 dark:text-slate-400">
                    <li>本サービスは、掲示板上のコンテンツの正確性・完全性について保証しません。</li>
                    <li>掲示板上の情報を利用したことによる損害について、管理者は責任を負いません。</li>
                    <li>サービスの停止・中断・変更によって生じた損害について、管理者は責任を負いません。</li>
                  </ul>
                </section>

                <section className="space-y-2">
                  <h4 className="font-bold text-slate-900 dark:text-white">第5条（規約への同意）</h4>
                  <p className="text-slate-600 dark:text-slate-400">
                    書き込みを行った時点で、本利用規約に同意したものとみなします。
                    規約は予告なく変更される場合があります。
                    最新の規約をご確認のうえご利用ください。
                  </p>
                </section>
              </div>
            </div>
          )}
        </div>
        </main>
      </div>
    </div>
  )
}
