import { useRef, useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { createThread } from '../api/threads'
import { useTurnstileStore } from '../stores/turnstileStore'
import { useThreads } from '../hooks/useThreads'
import { TurnstileRequiredError, ApiError } from '../api/client'
import { env } from '../config/env'
import { getThreadDraft, saveThreadDraft, clearThreadDraft } from '../utils/draftCache'
import { hasTosAgreed, setTosAgreed } from '../utils/tosAgreement'
import { useSettingsStore } from '../stores/settingsStore'
import { recordPost } from '../utils/postHistory'
import ImageUploadButton from '../components/ui/ImageUploadButton'
import ContentPreview from '../components/ui/ContentPreview'

export default function NewThreadPage() {
  const { boardId } = useParams<{ boardId: string }>()
  const navigate = useNavigate()
  const contentRef = useRef<HTMLTextAreaElement>(null)
  const [tosAgreed, setTosAgreedState] = useState(() => hasTosAgreed())
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isTurnstileError, setIsTurnstileError] = useState(false)
  const { data: boardData } = useThreads(boardId)
  const turnstileValid = useTurnstileStore((s) => s.isValid())
  const setTurnstileSession = useTurnstileStore((s) => s.setSession)
  const defaultPosterName = useSettingsStore((s) => s.defaultPosterName)
  const defaultSubInfo = useSettingsStore((s) => s.defaultSubInfo)
  const postHistoryMaxGenerations = useSettingsStore((s) => s.postHistoryMaxGenerations)

  const board = boardData?.data.board

  // 下書き復元
  useEffect(() => {
    if (!boardId) return
    const draft = getThreadDraft(boardId)
    if (draft) {
      setTitle(draft.title)
      setContent(draft.content)
    }
  }, [boardId])

  // 下書き自動保存
  useEffect(() => {
    if (!boardId) return
    if (title.trim() || content.trim()) {
      saveThreadDraft(boardId, title, content, env.threadCacheGen)
    }
  }, [title, content, boardId])

  const mutation = useMutation({
    mutationFn: () => createThread(boardId!, {
      title,
      content,
      ...(defaultPosterName.trim() ? { posterName: defaultPosterName.trim() } : {}),
      ...(defaultSubInfo.trim() ? { posterOptionInfo: defaultSubInfo.trim() } : {}),
    }),
    onSuccess: (res) => {
      recordPost({
        type: 'thread',
        boardId: boardId!,
        threadId: res.data.thread.id,
        threadTitle: title,
        contentSnippet: content.slice(0, 100),
        postNumber: res.data.firstPost.postNumber,
      }, postHistoryMaxGenerations)
      clearThreadDraft(boardId!)
      navigate(`/${boardId}/${res.data.thread.id}`)
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
          setError('スレッドの作成に失敗しました')
        }
      }
    },
  })

  function handleContentInput(e: React.FormEvent<HTMLTextAreaElement>) {
    const ta = e.currentTarget
    ta.style.height = 'auto'
    const maxH = Math.floor(window.innerHeight * 0.5)
    ta.style.height = `${Math.min(ta.scrollHeight, maxH)}px`
  }

  function handleImageUploaded(url: string) {
    const ta = contentRef.current
    if (!ta) {
      setContent((prev) => prev + (prev ? '\n' : '') + url)
      return
    }
    const start = ta.selectionStart ?? ta.value.length
    const end = ta.selectionEnd ?? ta.value.length
    const newContent = ta.value.slice(0, start) + url + ta.value.slice(end)
    setContent(newContent)
    setTimeout(() => {
      ta.focus()
      ta.setSelectionRange(start + url.length, start + url.length)
    }, 0)
  }

  async function handleSubmit() {
    if (!title.trim() || !content.trim()) return
    setError(null)
    setIsTurnstileError(false)
    setTosAgreed()
    setTosAgreedState(true)

    if (env.disableTurnstile && !turnstileValid) {
      setTurnstileSession('dev-turnstile-disabled')
    }

    mutation.mutate()
  }

  const turnstileReturnTo = encodeURIComponent(window.location.href)

  return (
    <div className="relative flex h-screen min-h-screen w-full flex-col overflow-x-hidden bg-c-base text-slate-700 dark:text-slate-200">
      {/* ナビゲーションヘッダー */}
      <header className="flex items-center justify-between border-b border-c-border bg-c-surface/80 backdrop-blur-md px-6 py-4 sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-c-accent text-[var(--c-accent-text)] shadow-lg">
            <span className="material-symbols-outlined">edit_square</span>
          </div>
          <div className="flex flex-col">
            <h2 className="text-slate-900 dark:text-white text-xl font-bold leading-tight tracking-tight">
              新規スレッド作成
            </h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              {board ? `${board.name}板` : boardId}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {!tosAgreed && (
            <p className="text-[10px] text-slate-400">
              投稿することで
              <button
                type="button"
                className="underline hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                onClick={() => navigate('/settings?tab=terms')}
              >
                利用規約
              </button>
              に同意したことになります
            </p>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate(`/${boardId}`)}
              className="flex min-w-[84px] cursor-pointer items-center justify-center rounded-xl h-10 px-6 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm font-bold"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={mutation.isPending || !title.trim() || !content.trim()}
              className="flex min-w-[84px] cursor-pointer items-center justify-center rounded-xl h-10 px-6 bg-c-accent text-[var(--c-accent-text)] hover:opacity-90 disabled:opacity-50 transition-colors text-sm font-bold shadow-lg"
            >
              {mutation.isPending ? '投稿中...' : '投稿する'}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center py-8 px-4 overflow-y-auto custom-scrollbar">
        <div className="w-full max-w-[800px] flex flex-col gap-8">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              {isTurnstileError && !env.disableTurnstile && env.turnstileTokenUrl ? (
                <span>
                  <a
                    href={`${env.turnstileTokenUrl}?returnTo=${turnstileReturnTo}`}
                    className="underline font-medium hover:text-red-300"
                  >
                    ここ
                  </a>
                  からturnstileの設定をしてください
                </span>
              ) : (
                <>
                  {error}
                  {!env.disableTurnstile && env.turnstileTokenUrl && (
                    <span className="block mt-1">
                      <a
                        href={`${env.turnstileTokenUrl}?returnTo=${turnstileReturnTo}`}
                        className="underline font-medium hover:text-red-300"
                      >
                        ここ
                      </a>
                      からturnstileの設定をしてください
                    </span>
                  )}
                </>
              )}
            </div>
          )}

          {/* タイトル */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-slate-500 ml-1 uppercase tracking-widest">
              スレッドのタイトル
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={board?.maxThreadTitleLength ?? 200}
              className="w-full bg-c-surface2 border border-c-border rounded-xl px-4 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-blue-600/50 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 transition-all"
              placeholder="スレッドのタイトルを入力してください..."
            />
          </div>

          {/* エディター */}
          <div className="flex flex-col gap-2">
            <div className="relative bg-c-surface2 border border-c-border rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-c-accent/50 transition-all">
              <textarea
                ref={contentRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onInput={handleContentInput}

                className="w-full min-h-[12rem] bg-transparent border-none p-6 text-base focus:ring-0 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 resize-none leading-relaxed overflow-y-auto"
                style={{ maxHeight: '50vh' }}
                placeholder="本文を入力してください..."
              />
            </div>
            {/* 画像プレビュー（最大2行、縦スクロール） */}
            <ContentPreview content={content} className="px-1 max-h-[15rem]" />
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase tracking-tight">
                <span className="material-symbols-outlined text-sm">info</span>
                <span>画像は外部サービスのURLを貼り付けると自動的に展開されます</span>
              </div>
              <ImageUploadButton onUploaded={handleImageUploaded} />
            </div>
          </div>

          {/* 注意事項 */}
          <div className="p-6 rounded-xl border border-blue-500/10 bg-blue-500/5 flex items-start gap-4 mb-8">
            <div className="p-2 bg-blue-600/20 rounded-lg text-blue-500 mt-1">
              <span className="material-symbols-outlined">info</span>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-slate-900 dark:text-white text-sm font-bold leading-tight">
                匿名投稿に関する注意事項
              </p>
              <div className="text-slate-500 text-sm font-normal leading-relaxed space-y-1">
                <p>・投稿は匿名で行われますが、サーバー側で自動的に識別用IDが生成されます。</p>
                <p>・一度投稿した内容は、管理者に依頼しない限り削除・編集できない場合があります。</p>
                <p>・氏名、電話番号、住所などの個人情報は絶対に入力しないでください。</p>
                <p>・公序良俗に反する内容や、他者を誹謗中傷する投稿は制限の対象となります。</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* モバイル用スティッキーボタン */}
      <div className="lg:hidden sticky bottom-0 left-0 right-0 p-4 bg-c-base/90 backdrop-blur-sm border-t border-c-border">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={mutation.isPending || !title.trim() || !content.trim()}
          className="w-full flex cursor-pointer items-center justify-center rounded-xl h-12 bg-c-accent text-[var(--c-accent-text)] text-base font-bold shadow-lg disabled:opacity-50"
        >
          {mutation.isPending ? '投稿中...' : '投稿する'}
        </button>
      </div>
    </div>
  )
}
