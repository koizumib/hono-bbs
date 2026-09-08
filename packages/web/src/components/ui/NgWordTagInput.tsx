import { useState } from 'react'
import { isValidNgPattern } from '../../utils/filter'

interface NgWordTagInputProps {
  value: string
  onChange: (value: string) => void
  useRegex?: boolean
  placeholder?: string
}

// NGワードを改行区切りの文字列として保持する既存フォーマットはそのまま維持しつつ、
// 1語ずつchipで追加・削除できるタグ入力UIにする。
export default function NgWordTagInput({ value, onChange, useRegex = false, placeholder }: NgWordTagInputProps) {
  const words = value.split('\n').map((w) => w.trim()).filter(Boolean)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  function commitDraft() {
    const word = draft.trim()
    if (!word) return
    if (!isValidNgPattern(word, useRegex)) {
      setError('無効な正規表現です')
      return
    }
    setDraft('')
    setError(null)
    if (words.includes(word)) return
    onChange([...words, word].join('\n'))
  }

  function removeWord(word: string) {
    onChange(words.filter((w) => w !== word).join('\n'))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // ","はEnterと違い正規表現の量指定子 (例: a{1,3}) の一部になり得るため、コミットには使わない
    if (e.key === 'Enter') {
      e.preventDefault()
      commitDraft()
    } else if (e.key === 'Backspace' && draft === '' && words.length > 0) {
      removeWord(words[words.length - 1])
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 p-2 min-h-[2.75rem]">
        {words.map((word) => {
          const invalid = useRegex && !isValidNgPattern(word, useRegex)
          return (
            <span
              key={word}
              title={invalid ? '無効な正規表現です（マッチ判定から除外されます）' : undefined}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-mono ${
                invalid
                  ? 'bg-red-500/10 border border-red-500/40 text-red-400'
                  : 'bg-c-accent/10 border border-c-accent/20 text-slate-700 dark:text-slate-200'
              }`}
            >
              {invalid && <span className="material-symbols-outlined text-[13px]">error</span>}
              {word}
              <button
                type="button"
                onClick={() => removeWord(word)}
                className="hover:text-red-400 transition-colors"
              >
                <span className="material-symbols-outlined text-[14px] leading-none">close</span>
              </button>
            </span>
          )
        })}
        <input
          type="text"
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setError(null) }}
          onKeyDown={handleKeyDown}
          onBlur={commitDraft}
          placeholder={words.length === 0 ? (placeholder ?? '入力してEnterで追加...') : '追加...'}
          className="flex-1 min-w-[8rem] bg-transparent border-none text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-0 py-1"
        />
      </div>
      {error && <p className="text-[11px] text-red-400 px-2 pb-1.5">{error}</p>}
    </div>
  )
}
