import { useState } from 'react'
import { useSettingsStore, type NgRule, type NgTarget } from '../../stores/settingsStore'
import { isValidNgPattern } from '../../utils/filter'

const TARGETS: { key: NgTarget; label: string }[] = [
  { key: 'threadTitle', label: 'スレッドタイトル' },
  { key: 'posterId', label: '投稿者ID' },
  { key: 'posterName', label: '名前（コテハン）' },
  { key: 'content', label: 'レス（本文）' },
]

function AddNgRuleModal({ target, label, onClose }: { target: NgTarget; label: string; onClose: () => void }) {
  const addNgRule = useSettingsStore((s) => s.addNgRule)
  const [pattern, setPattern] = useState('')
  const [isRegex, setIsRegex] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleAdd() {
    const trimmed = pattern.trim()
    if (!trimmed) {
      setError('パターンを入力してください')
      return
    }
    if (!isValidNgPattern(trimmed, isRegex)) {
      setError('無効な正規表現です')
      return
    }
    addNgRule({ target, pattern: trimmed, isRegex, enabled: true })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-c-surface border border-c-border rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 dark:text-white">{label}にNGワードを追加</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">パターン</label>
          <input
            type="text"
            autoFocus
            value={pattern}
            onChange={(e) => { setPattern(e.target.value); setError(null) }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
            placeholder="単語または正規表現を入力..."
            className="w-full bg-c-surface2 border border-c-border rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-c-accent/50 text-sm font-mono"
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isRegex}
            onChange={(e) => { setIsRegex(e.target.checked); setError(null) }}
            className="rounded border-c-border bg-c-surface2 text-c-accent focus:ring-c-accent/50 h-4 w-4"
          />
          <span className="text-sm text-slate-700 dark:text-slate-300">正規表現として扱う</span>
        </label>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 border border-c-border bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl text-sm font-bold transition-all"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleAdd}
            className="px-6 py-2 bg-c-accent hover:opacity-90 text-[var(--c-accent-text)] rounded-xl text-sm font-bold shadow-lg transition-all"
          >
            追加
          </button>
        </div>
      </div>
    </div>
  )
}

function NgRuleRow({ rule }: { rule: NgRule }) {
  const removeNgRule = useSettingsStore((s) => s.removeNgRule)
  const setNgRuleEnabled = useSettingsStore((s) => s.setNgRuleEnabled)
  const setNgRuleRegex = useSettingsStore((s) => s.setNgRuleRegex)
  const invalid = rule.isRegex && !isValidNgPattern(rule.pattern, true)

  return (
    <div className={`flex items-center gap-2 px-4 py-2.5 ${rule.enabled ? '' : 'opacity-50'}`}>
      <button
        type="button"
        role="switch"
        aria-checked={rule.enabled}
        onClick={() => setNgRuleEnabled(rule.id, !rule.enabled)}
        title={rule.enabled ? '無効にする' : '有効にする'}
        className={`w-9 h-5 rounded-full relative transition-all flex-shrink-0 ${
          rule.enabled ? 'bg-c-accent' : 'bg-slate-300 dark:bg-slate-700'
        }`}
      >
        <div
          className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
            rule.enabled ? 'right-0.5' : 'left-0.5'
          }`}
        />
      </button>

      <span
        className={`flex-1 min-w-0 truncate text-sm font-mono flex items-center gap-1 ${
          invalid ? 'text-red-400' : 'text-slate-700 dark:text-slate-200'
        }`}
        title={invalid ? '無効な正規表現です（マッチ判定から除外されます）' : rule.pattern}
      >
        {invalid && <span className="material-symbols-outlined text-[13px] flex-shrink-0">error</span>}
        <span className="truncate">{rule.pattern}</span>
      </span>

      <label className="flex items-center gap-1 text-[10px] text-slate-500 flex-shrink-0 cursor-pointer">
        <input
          type="checkbox"
          checked={rule.isRegex}
          onChange={(e) => setNgRuleRegex(rule.id, e.target.checked)}
          className="rounded border-c-border bg-c-surface2 text-c-accent focus:ring-c-accent/50 h-3.5 w-3.5"
        />
        正規表現
      </label>

      <button
        type="button"
        onClick={() => removeNgRule(rule.id)}
        title="削除"
        className="text-slate-400 hover:text-red-400 transition-colors flex-shrink-0"
      >
        <span className="material-symbols-outlined text-lg">delete</span>
      </button>
    </div>
  )
}

function NgRuleCategoryCard({ target, label }: { target: NgTarget; label: string }) {
  // ngRules をそのまま購読し(参照が安定するのは実際に変更があった時だけ)、絞り込みは
  // レンダー内のローカル計算にする。selector内で.filter()すると毎回新しい配列参照になり
  // useSyncExternalStoreが無限に再レンダーを誘発してしまう。
  const allRules = useSettingsStore((s) => s.ngRules)
  const rules = allRules.filter((r) => r.target === target)
  const [showAddModal, setShowAddModal] = useState(false)
  const [search, setSearch] = useState('')
  const filteredRules = search.trim()
    ? rules.filter((r) => r.pattern.toLowerCase().includes(search.trim().toLowerCase()))
    : rules

  return (
    <div className="bg-c-surface2 rounded-2xl border border-c-border shadow-lg overflow-hidden flex flex-col">
      <div className="px-5 py-3 bg-slate-100/50 dark:bg-slate-800/30 border-b border-c-border flex justify-between items-center flex-shrink-0">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          {label}
        </label>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="text-c-accent hover:opacity-80 transition-opacity flex items-center gap-1 text-[11px] font-bold"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          追加
        </button>
      </div>
      {rules.length > 0 && (
        <div className="px-3 pt-2.5 pb-1 flex-shrink-0">
          <div className="relative">
            <span className="material-symbols-outlined text-[16px] text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none">
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="検索..."
              className="w-full bg-c-surface border border-c-border rounded-lg pl-7 pr-2 py-1.5 text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-c-accent/50"
            />
          </div>
        </div>
      )}
      {rules.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500">NGワードは登録されていません</div>
      ) : filteredRules.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500">一致するNGワードがありません</div>
      ) : (
        <div className="divide-y divide-c-border max-h-72 overflow-y-auto custom-scrollbar">
          {filteredRules.map((rule) => (
            <NgRuleRow key={rule.id} rule={rule} />
          ))}
        </div>
      )}
      {showAddModal && (
        <AddNgRuleModal target={target} label={label} onClose={() => setShowAddModal(false)} />
      )}
    </div>
  )
}

// NGワードをカテゴリ(スレタイ/投稿者ID/名前/本文)ごとに分けて管理するUI。
// カテゴリ内では1件ずつのレコードとして持ち、有効/無効・正規表現有無を個別に切り替えられる。
export default function NgRuleManager() {
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        カテゴリごとに「追加」からNGワードを登録します。一致したスレッド・レスは一覧から非表示になります。
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {TARGETS.map(({ key, label }) => (
          <NgRuleCategoryCard key={key} target={key} label={label} />
        ))}
      </div>
    </div>
  )
}
