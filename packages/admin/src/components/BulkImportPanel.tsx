import { useState } from 'react'
import Button from './ui/Button'
import Card from './ui/Card'

interface RowResult {
  index: number
  ok: boolean
  message: string
}

interface BulkImportPanelProps<T> {
  title: string
  example: string
  onImportRow: (row: T) => Promise<unknown>
  onDone: () => void
}

// JSON配列を貼り付けて1件ずつ作成APIに投げる汎用パネル。要素の妥当性チェックは行わない
// (作成API自体がサーバー側でzod検証するため、不正な行はここでエラーとして表示すればよい)。
export default function BulkImportPanel<T>({ title, example, onImportRow, onDone }: BulkImportPanelProps<T>) {
  const [text, setText] = useState('')
  const [parseError, setParseError] = useState<string | null>(null)
  const [rows, setRows] = useState<T[] | null>(null)
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<RowResult[] | null>(null)

  function handleTextChange(value: string) {
    setText(value)
    setResults(null)
    if (!value.trim()) {
      setRows(null)
      setParseError(null)
      return
    }
    try {
      const parsed = JSON.parse(value)
      if (!Array.isArray(parsed)) {
        setRows(null)
        setParseError('JSON配列 ([...]) 形式で入力してください')
        return
      }
      setRows(parsed as T[])
      setParseError(null)
    } catch (e) {
      setRows(null)
      setParseError(e instanceof Error ? e.message : 'JSONの形式が正しくありません')
    }
  }

  async function handleRun() {
    if (!rows) return
    setRunning(true)
    const newResults: RowResult[] = []
    for (let i = 0; i < rows.length; i++) {
      try {
        await onImportRow(rows[i])
        newResults.push({ index: i, ok: true, message: '成功' })
      } catch (e) {
        newResults.push({ index: i, ok: false, message: e instanceof Error ? e.message : '失敗' })
      }
    }
    setResults(newResults)
    setRunning(false)
    onDone()
  }

  const successCount = results?.filter((r) => r.ok).length ?? 0

  return (
    <Card className="flex flex-col gap-3 p-4">
      <h3 className="font-medium">{title}</h3>
      <textarea
        value={text}
        onChange={(e) => handleTextChange(e.target.value)}
        placeholder={example}
        rows={8}
        className="w-full rounded border border-border-dark bg-surface-dark-2 px-2 py-1.5 font-mono text-xs"
      />

      {parseError && <p className="text-sm text-red-400">{parseError}</p>}
      {rows && !parseError && (
        <p className="text-sm text-gray-400">{rows.length}件を検出しました</p>
      )}

      {results && (
        <div className="flex flex-col gap-1 rounded border border-border-dark/50 p-2 text-sm">
          <p className="text-gray-300">
            成功: {successCount}件 / 失敗: {results.length - successCount}件
          </p>
          {results.filter((r) => !r.ok).map((r) => (
            <p key={r.index} className="text-red-400">
              行{r.index + 1}: {r.message}
            </p>
          ))}
        </div>
      )}

      <Button variant="filled" onClick={handleRun} disabled={!rows || rows.length === 0 || running} className="self-start">
        {running ? '実行中...' : '実行'}
      </Button>
    </Card>
  )
}
