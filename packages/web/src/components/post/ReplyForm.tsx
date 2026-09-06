import { useRef, useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { createPost } from '../../api/posts'
import { useTurnstileStore } from '../../stores/turnstileStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { TurnstileRequiredError, ApiError } from '../../api/client'
import { env } from '../../config/env'
import { useDragResize } from '../../hooks/useDragResize'
import { getPostDraft, savePostDraft, clearPostDraft } from '../../utils/draftCache'
import { recordPost } from '../../utils/postHistory'
import { hasTosAgreed, setTosAgreed } from '../../utils/tosAgreement'
import ImageUploadButton from '../ui/ImageUploadButton'
import ContentPreview from '../ui/ContentPreview'

const COOLDOWN_MS = 3000

interface ReplyFormProps {
  boardId: string
  threadId: string
  threadTitle?: string
  layout: 'bottom' | 'right' | 'sheet'
  insertAnchor?: { text: string; seq: number } | null
  onPosted?: () => void
}

function TurnstileErrorMessage() {
  const returnTo = encodeURIComponent(window.location.href)
  return (
    <span>
      <a
        href={`${env.turnstileTokenUrl}?returnTo=${returnTo}`}
        className="underline font-medium hover:text-red-300"
      >
        ここ
      </a>
      からturnstileの設定をしてください
    </span>
  )
}

export default function ReplyForm({
  boardId,
  threadId,
  threadTitle,
  layout,
  insertAnchor,
  onPosted,
}: ReplyFormProps) {
  const navigate = useNavigate()
  const [tosAgreed, setTosAgreedState] = useState(() => hasTosAgreed())
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isTurnstileError, setIsTurnstileError] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const [isAA, setIsAA] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isSubmittingRef = useRef(false)
  const lastPostTimeRef = useRef(0)
  const [cooldownSec, setCooldownSec] = useState(0)

  const defaultPosterName = useSettingsStore((s) => s.defaultPosterName)
  const defaultSubInfo = useSettingsStore((s) => s.defaultSubInfo)
  const postHistoryMaxGenerations = useSettingsStore((s) => s.postHistoryMaxGenerations)

  const [posterName, setPosterName] = useState(defaultPosterName)
  const [subInfo, setSubInfo] = useState(defaultSubInfo)

  // 下書き復元
  useEffect(() => {
    const draft = getPostDraft(boardId, threadId)
    if (draft?.content) {
      setContent(draft.content)
    }
  }, [boardId, threadId])

  // 下書き自動保存
  useEffect(() => {
    if (content.trim()) {
      savePostDraft(boardId, threadId, content, env.postCacheGen)
    }
  }, [content, boardId, threadId])

  // 閉じるとき（アンマウント時）にも必ず保存
  const contentRef = useRef(content)
  useEffect(() => { contentRef.current = content }, [content])
  useEffect(() => {
    return () => {
      if (contentRef.current.trim()) {
        savePostDraft(boardId, threadId, contentRef.current, env.postCacheGen)
      }
    }
  }, [boardId, threadId])

  useEffect(() => {
    setPosterName(defaultPosterName)
  }, [defaultPosterName])

  useEffect(() => {
    if (cooldownSec <= 0) return
    const id = setTimeout(() => setCooldownSec((s) => Math.max(0, s - 1)), 1000)
    return () => clearTimeout(id)
  }, [cooldownSec])

  useEffect(() => {
    if (!insertAnchor) return
    const ta = textareaRef.current
    if (!ta) return
    if (!ta.value.trim()) {
      // 空のとき: アンカー+改行を入力して末尾にカーソル
      const anchor = `>>${insertAnchor.text}\n`
      setContent(anchor)
      setTimeout(() => {
        ta.focus()
        ta.setSelectionRange(anchor.length, anchor.length)
      }, 0)
    } else {
      // 入力中のとき: 末尾に半角スペース+アンカーを追記（改行なし）
      const anchor = ` >>${insertAnchor.text}`
      const newContent = ta.value + anchor
      setContent(newContent)
      setTimeout(() => {
        ta.focus()
        ta.setSelectionRange(newContent.length, newContent.length)
      }, 0)
    }
  }, [insertAnchor])

  const queryClient = useQueryClient()
  const turnstileValid = useTurnstileStore((s) => s.isValid())
  const setTurnstileSession = useTurnstileStore((s) => s.setSession)

  // 右パネル幅のリサイズ（左端ドラッグ）
  const { size: rightWidth, onMouseDown: onRightDrag } = useDragResize({
    storageKey: 'bbs-reply-right-width',
    defaultSize: 320,
    direction: 'horizontal',
    inverted: true,
    min: 200,
    max: 600,
  })

  // 下フッター高さのリサイズ（上端ドラッグ）
  const { size: bottomHeight, onMouseDown: onBottomDrag } = useDragResize({
    storageKey: 'bbs-reply-bottom-height',
    defaultSize: 160,
    direction: 'vertical',
    inverted: true,
    min: 80,
    max: 500,
  })

  const mutation = useMutation({
    mutationFn: () =>
      createPost(boardId, threadId, {
        content,
        ...(posterName.trim() ? { posterName: posterName.trim() } : {}),
        ...(subInfo.trim() ? { posterOptionInfo: subInfo.trim() } : {}),
      }),
    onSuccess: (res) => {
      recordPost({
        type: 'post',
        boardId,
        threadId,
        threadTitle: threadTitle ?? threadId,
        contentSnippet: content.slice(0, 100),
        postNumber: res.data.postNumber,
      }, postHistoryMaxGenerations)
      lastPostTimeRef.current = Date.now()
      isSubmittingRef.current = false
      setCooldownSec(Math.ceil(COOLDOWN_MS / 1000))
      onPosted?.()
      setContent('')
      setError(null)
      setIsTurnstileError(false)
      clearPostDraft(boardId, threadId)
      queryClient.invalidateQueries({ queryKey: ['posts', boardId, threadId] })
    },
    onError: (err) => {
      isSubmittingRef.current = false
      if (err instanceof TurnstileRequiredError) {
        setIsTurnstileError(true)
        setError('turnstile')
      } else {
        setIsTurnstileError(false)
        if (err instanceof ApiError) {
          setError(err.message)
        } else {
          setError('投稿に失敗しました')
        }
      }
    },
  })

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      void handleSubmit()
    }
  }

  function handleInput() {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = '0'
    ta.style.height = `${ta.scrollHeight}px`
  }

  function handleImageUploaded(url: string) {
    const ta = textareaRef.current
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
    if (isSubmittingRef.current) return
    if (Date.now() - lastPostTimeRef.current < COOLDOWN_MS) return
    if (!content.trim()) return
    isSubmittingRef.current = true
    setError(null)
    setIsTurnstileError(false)
    setTosAgreed()
    setTosAgreedState(true)

    if (env.disableTurnstile && !turnstileValid) {
      setTurnstileSession('dev-turnstile-disabled')
    }

    mutation.mutate()
  }

  const tosNotice = !tosAgreed && (
    <p className="text-[10px] text-slate-400 flex-shrink-0 px-1">
      書き込みを行うことで
      <button
        type="button"
        className="underline hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        onClick={() => navigate('/settings?tab=terms')}
      >
        利用規約
      </button>
      に同意したことになります
    </p>
  )

  const aaCheckbox = (
    <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
      <input
        type="checkbox"
        checked={isAA}
        onChange={(e) => setIsAA(e.target.checked)}
        className="rounded"
      />
      AA
    </label>
  )

  const errorNode = error && (
    <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs flex-shrink-0">
      {isTurnstileError && !env.disableTurnstile && env.turnstileTokenUrl ? (
        <TurnstileErrorMessage />
      ) : (
        <>
          {error}
          {!env.disableTurnstile && env.turnstileTokenUrl && (
            <span className="block mt-0.5"><TurnstileErrorMessage /></span>
          )}
        </>
      )}
    </div>
  )

  if (layout === 'right') {
    return (
      <div
        style={{ width: rightWidth }}
        className="flex-shrink-0 flex h-full bg-c-surface border-l border-c-border relative"
      >
        {/* 左端ドラッグハンドル */}
        <div
          className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-c-accent/30 transition-colors z-10"
          onMouseDown={onRightDrag}
        />

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden pl-2">
          <div className="px-4 py-3 border-b border-c-border flex items-center justify-between flex-shrink-0">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">書き込む</span>
            <div className="flex items-center gap-3">
              <ImageUploadButton onUploaded={handleImageUploaded} />
              {aaCheckbox}
            </div>
          </div>
          {errorNode}
          <div className="flex-1 flex flex-col p-4 gap-3 min-h-0 overflow-y-auto custom-scrollbar">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              className={`flex-1 bg-transparent border border-c-border rounded-xl px-3 py-2 focus:ring-2 focus:ring-c-accent/50 focus:outline-none text-slate-700 dark:text-slate-200 placeholder-slate-400 resize-none custom-scrollbar text-sm min-h-[120px] max-h-[50vh] overflow-y-auto ${isAA ? 'aa-font' : ''}`}
              placeholder="返信を書き込む..."
            />
            {/* 画像プレビュー（最大2行、縦スクロール） */}
            <ContentPreview content={content} className="flex-shrink-0 max-h-[11rem]" />
            <div className="flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowOptions(!showOptions)}
                className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-white flex items-center gap-1 transition-colors mb-2"
              >
                <span className="material-symbols-outlined text-sm">
                  {showOptions ? 'expand_less' : 'expand_more'}
                </span>
                オプション
              </button>
              {showOptions && (
                <div className="space-y-2 mb-3">
                  <input
                    type="text"
                    value={posterName}
                    onChange={(e) => setPosterName(e.target.value)}
                    placeholder="投稿者名"
                    className="w-full bg-transparent border border-c-border rounded-lg px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:ring-2 focus:ring-c-accent/50 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={subInfo}
                    onChange={(e) => setSubInfo(e.target.value)}
                    placeholder="オプション欄（sage など）"
                    className="w-full bg-transparent border border-c-border rounded-lg px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:ring-2 focus:ring-c-accent/50 focus:outline-none"
                  />
                </div>
              )}
            </div>
            {tosNotice}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={mutation.isPending || !content.trim() || cooldownSec > 0}
              className="bg-c-accent hover:opacity-90 disabled:opacity-50 text-white px-5 py-2 rounded-xl font-bold text-sm transition-all flex-shrink-0"
            >
              {mutation.isPending ? '送信中...' : cooldownSec > 0 ? `連投制限中 (${cooldownSec}s)` : '書き込む'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // sheet layout (モバイル用ボトムシート内)
  if (layout === 'sheet') {
    return (
      <div className="flex flex-col px-4 pb-safe gap-3">
        {errorNode}
        <div className="flex items-center gap-3 pt-1">
          {aaCheckbox}
          <ImageUploadButton onUploaded={handleImageUploaded} />
          <button
            type="button"
            onClick={() => setShowOptions(!showOptions)}
            className="ml-auto text-xs text-slate-400 hover:text-slate-700 dark:hover:text-white flex items-center gap-1 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">
              {showOptions ? 'expand_less' : 'expand_more'}
            </span>
            オプション
          </button>
        </div>
        {showOptions && (
          <div className="space-y-2">
            <input
              type="text"
              value={posterName}
              onChange={(e) => setPosterName(e.target.value)}
              placeholder="投稿者名"
              className="w-full bg-transparent border border-c-border rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:ring-2 focus:ring-c-accent/50 focus:outline-none"
            />
            <input
              type="text"
              value={subInfo}
              onChange={(e) => setSubInfo(e.target.value)}
              placeholder="オプション欄（sage など）"
              className="w-full bg-transparent border border-c-border rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:ring-2 focus:ring-c-accent/50 focus:outline-none"
            />
          </div>
        )}
        <ContentPreview content={content} className="flex-shrink-0 max-h-[8rem]" />
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          autoFocus
          style={{ minHeight: 'calc(100dvh / 3)' }}
          className={`w-full bg-transparent border border-c-border rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-c-accent/50 focus:outline-none text-slate-700 dark:text-slate-200 placeholder-slate-400 resize-none custom-scrollbar text-sm ${isAA ? 'aa-font' : ''}`}
          placeholder="返信を書き込む..."
        />
        {tosNotice}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={mutation.isPending || !content.trim() || cooldownSec > 0}
          className="w-full bg-c-accent hover:opacity-90 disabled:opacity-50 text-white py-3 rounded-xl font-bold text-sm transition-all"
        >
          {mutation.isPending ? '送信中...' : cooldownSec > 0 ? `連投制限中 (${cooldownSec}s)` : '書き込む'}
        </button>
      </div>
    )
  }

  // bottom layout
  return (
    <footer
      style={{ height: bottomHeight }}
      className="bg-c-surface border-t border-c-border flex flex-col flex-shrink-0"
    >
      {/* 上端ドラッグハンドル */}
      <div
        className="h-2 flex-shrink-0 cursor-row-resize hover:bg-c-accent/30 transition-colors"
        onMouseDown={onBottomDrag}
      />

      {errorNode}

      <div className="flex items-center px-4 py-2 border-b border-c-border bg-slate-100/50 dark:bg-slate-800/30 gap-3 flex-shrink-0">
        {aaCheckbox}
        <ImageUploadButton onUploaded={handleImageUploaded} />
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setShowOptions(!showOptions)}
          className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-white flex items-center gap-1 transition-colors"
        >
          <span className="material-symbols-outlined text-sm">
            {showOptions ? 'expand_less' : 'expand_more'}
          </span>
          オプション
        </button>
      </div>

      {showOptions && (
        <div className="flex items-center gap-3 px-4 py-2 border-b border-c-border bg-slate-50 dark:bg-slate-800/20 flex-shrink-0">
          <input
            type="text"
            value={posterName}
            onChange={(e) => setPosterName(e.target.value)}
            placeholder="投稿者名"
            className="flex-1 bg-transparent border border-c-border rounded-lg px-3 py-1 text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:ring-2 focus:ring-c-accent/50 focus:outline-none"
          />
          <input
            type="text"
            value={subInfo}
            onChange={(e) => setSubInfo(e.target.value)}
            placeholder="オプション欄（sage など）"
            className="flex-1 bg-transparent border border-c-border rounded-lg px-3 py-1 text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:ring-2 focus:ring-c-accent/50 focus:outline-none"
          />
        </div>
      )}

      {/* 画像プレビュー（1行横スクロール、高さ固定） */}
      <ContentPreview content={content} nowrap className="px-4 pt-2 flex-shrink-0 h-[5.5rem]" />

      <div className="flex items-stretch px-3 pb-1 pt-1 gap-4 flex-1 min-h-0">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          className={`flex-1 bg-transparent border-none focus:ring-0 text-slate-700 dark:text-slate-200 placeholder-slate-400 resize-none custom-scrollbar text-sm overflow-y-auto ${isAA ? 'aa-font' : ''}`}
          placeholder="返信を書き込む..."
        />
        <div className="flex flex-col items-end gap-1 flex-shrink-0 self-end pb-2">
          {tosNotice}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={mutation.isPending || !content.trim() || cooldownSec > 0}
            className="bg-c-accent hover:opacity-90 disabled:opacity-50 text-white px-5 rounded-xl font-bold text-sm transition-all py-2"
          >
            {mutation.isPending ? '送信中...' : cooldownSec > 0 ? `連投制限中 (${cooldownSec}s)` : '書き込む'}
          </button>
        </div>
      </div>
    </footer>
  )
}
