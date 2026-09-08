import { useState } from 'react'
import type { NgWordRule, NgWordTarget } from '../api/types'
import Button from './ui/Button'

const TARGET_LABELS: Record<NgWordTarget, string> = {
  title: 'スレタイ',
  posterName: '名前',
  content: '本文',
}

interface NgWordEditorProps {
  value: NgWordRule[]
  onChange: (value: NgWordRule[]) => void
}

// 板ごとのサーバー側NGワード。クライアント側 (packages/web) のNGワード機能とは別物で、
// 一致した投稿はサーバー側で実際に拒否される (VALIDATION目的ではなくmoderation目的)。
export default function NgWordEditor({ value, onChange }: NgWordEditorProps) {
  const [target, setTarget] = useState<NgWordTarget>('content')
  const [pattern, setPattern] = useState('')
  const [isRegex, setIsRegex] = useState(false)

  function handleAdd() {
    const trimmed = pattern.trim()
    if (!trimmed) return
    onChange([...value, { pattern: trimmed, isRegex, target }])
    setPattern('')
    setIsRegex(false)
  }

  function handleRemove(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        一致した投稿はサーバー側で拒否されます（クライアント側の閲覧用NGワードとは別物）。
      </p>
      {value.length > 0 && (
        <div className="rounded border border-border-dark divide-y divide-border-dark overflow-hidden">
          {value.map((rule, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 text-sm">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-dark-2 text-gray-400 flex-shrink-0">
                {TARGET_LABELS[rule.target]}
              </span>
              <span className="flex-1 min-w-0 truncate font-mono">{rule.pattern}</span>
              {rule.isRegex && <span className="text-[10px] text-gray-500 flex-shrink-0">正規表現</span>}
              <button
                type="button"
                onClick={() => handleRemove(i)}
                className="text-gray-500 hover:text-red-400 transition-colors flex-shrink-0"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value as NgWordTarget)}
          className="rounded border border-border-dark bg-surface-dark-2 px-2 py-1.5 text-sm"
        >
          {(Object.keys(TARGET_LABELS) as NgWordTarget[]).map((t) => (
            <option key={t} value={t}>{TARGET_LABELS[t]}</option>
          ))}
        </select>
        <input
          type="text"
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
          placeholder="単語または正規表現"
          className="flex-1 min-w-[8rem] rounded border border-border-dark bg-surface-dark-2 px-2 py-1.5 text-sm font-mono"
        />
        <label className="flex items-center gap-1.5 text-xs text-gray-400">
          <input type="checkbox" checked={isRegex} onChange={(e) => setIsRegex(e.target.checked)} />
          正規表現
        </label>
        <Button type="button" variant="filled" onClick={handleAdd}>追加</Button>
      </div>
    </div>
  )
}
