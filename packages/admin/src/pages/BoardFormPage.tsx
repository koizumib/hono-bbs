import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getBoard, createBoard, patchBoard, type CreateBoardInput } from '../api/boards'
import type { Board, NgWordRule } from '../api/types'
import AclEditor, { type AclInput } from '../components/AclEditor'
import NgWordEditor from '../components/NgWordEditor'
import ErrorBanner from '../components/ErrorBanner'
import Button from '../components/ui/Button'

const DEFAULT_ACL: AclInput = {
  grants: [],
  authenticatedActions: ['read', 'create', 'update', 'delete'],
  anonymousActions: ['read', 'create'],
}

function boardToFormState(board: Board): CreateBoardInput {
  return {
    name: board.name,
    description: board.description ?? '',
    category: board.category ?? '',
    icon: board.icon ?? null,
    colorTheme: board.colorTheme ?? null,
    maxThreads: board.maxThreads,
    maxThreadTitleLength: board.maxThreadTitleLength,
    defaultMaxPosts: board.defaultMaxPosts,
    defaultMaxPostLength: board.defaultMaxPostLength,
    defaultMaxPostLines: board.defaultMaxPostLines,
    defaultMaxPosterNameLength: board.defaultMaxPosterNameLength,
    defaultMaxPosterOptionLength: board.defaultMaxPosterOptionLength,
    defaultPosterName: board.defaultPosterName,
    defaultIdFormat: board.defaultIdFormat,
    acl: { grants: board.acl.grants, authenticatedActions: board.acl.authenticatedActions, anonymousActions: board.acl.anonymousActions },
    defaultThreadAcl: {
      grants: board.defaultThreadAcl.grants,
      authenticatedActions: board.defaultThreadAcl.authenticatedActions,
      anonymousActions: board.defaultThreadAcl.anonymousActions,
    },
    defaultPostAcl: {
      grants: board.defaultPostAcl.grants,
      authenticatedActions: board.defaultPostAcl.authenticatedActions,
      anonymousActions: board.defaultPostAcl.anonymousActions,
    },
    // ngWords は adminMeta と同様 isSysAdmin/isUserAdmin にのみ返るフィールド (api/types.ts 参照)
    ngWords: (board as Board & { ngWords?: NgWordRule[] }).ngWords ?? [],
  }
}

const NEW_BOARD_DEFAULT: CreateBoardInput = {
  id: '',
  name: '',
  description: '',
  category: '',
  icon: null,
  colorTheme: null,
  maxThreads: 1000,
  maxThreadTitleLength: 200,
  defaultMaxPosts: 1000,
  defaultMaxPostLength: 2000,
  defaultMaxPostLines: 100,
  defaultMaxPosterNameLength: 50,
  defaultMaxPosterOptionLength: 100,
  defaultPosterName: '名無しさん',
  defaultIdFormat: 'daily_hash',
  acl: DEFAULT_ACL,
  defaultThreadAcl: DEFAULT_ACL,
  defaultPostAcl: DEFAULT_ACL,
  ngWords: [],
}

export default function BoardFormPage() {
  const { boardId } = useParams<{ boardId: string }>()
  const isEdit = Boolean(boardId)
  const navigate = useNavigate()
  const [form, setForm] = useState<CreateBoardInput>(NEW_BOARD_DEFAULT)
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!boardId) return
    getBoard(boardId)
      .then((res) => setForm(boardToFormState(res.data)))
      .catch(setError)
      .finally(() => setLoading(false))
  }, [boardId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      if (isEdit && boardId) {
        await patchBoard(boardId, form)
      } else {
        // id は空文字だと「未指定」ではなく空文字としてバリデーションに引っかかるため、
        // 空のときはキー自体を送らない (サーバー側で crypto.randomUUID() が使われる)
        const { id, ...rest } = form
        await createBoard(id ? form : rest)
      }
      navigate('/boards')
    } catch (e) {
      setError(e)
    } finally {
      setSaving(false)
    }
  }

  function setField<K extends keyof CreateBoardInput>(key: K, value: CreateBoardInput[K]) {
    setForm((f: CreateBoardInput) => ({ ...f, [key]: value }))
  }

  if (loading) return <p className="text-sm text-gray-400">読み込み中...</p>

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-lg font-medium">{isEdit ? `板を編集: ${boardId}` : '板を作成'}</h1>

      <ErrorBanner error={error} />

      <h2 className="text-sm font-semibold text-gray-400">基本情報</h2>

      {!isEdit && (
        <label className="text-sm">
          ID (省略時はUUID自動生成)
          <input
            type="text"
            value={form.id ?? ''}
            onChange={(e) => setField('id', e.target.value)}
            className="mt-1 w-full rounded border border-border-dark bg-surface-dark-2 px-2 py-1.5"
          />
        </label>
      )}

      <label className="text-sm">
        名前 *
        <input
          type="text"
          required
          value={form.name}
          onChange={(e) => setField('name', e.target.value)}
          className="mt-1 w-full rounded border border-border-dark bg-surface-dark-2 px-2 py-1.5"
        />
      </label>

      <label className="text-sm">
        説明
        <textarea
          value={form.description ?? ''}
          onChange={(e) => setField('description', e.target.value)}
          className="mt-1 w-full rounded border border-border-dark bg-surface-dark-2 px-2 py-1.5"
        />
      </label>

      <label className="text-sm">
        カテゴリ
        <input
          type="text"
          value={form.category ?? ''}
          onChange={(e) => setField('category', e.target.value)}
          className="mt-1 w-full rounded border border-border-dark bg-surface-dark-2 px-2 py-1.5"
        />
      </label>

      <label className="text-sm">
        アイコンURL(未設定ならカラーテーマ背景+頭文字のアバターになります)
        <input
          type="text"
          value={form.icon ?? ''}
          onChange={(e) => setField('icon', e.target.value || null)}
          placeholder="https://..."
          className="mt-1 w-full rounded border border-border-dark bg-surface-dark-2 px-2 py-1.5"
        />
      </label>

      <label className="text-sm">
        カラーテーマ(アイコン未設定時のアバター背景色)
        <div className="mt-1 flex items-center gap-2">
          <input
            type="color"
            value={form.colorTheme ?? '#7566e6'}
            onChange={(e) => setField('colorTheme', e.target.value)}
            className="h-9 w-12 rounded border border-border-dark bg-surface-dark-2"
          />
          <input
            type="text"
            value={form.colorTheme ?? ''}
            onChange={(e) => setField('colorTheme', e.target.value || null)}
            placeholder="#7566e6"
            className="w-full rounded border border-border-dark bg-surface-dark-2 px-2 py-1.5"
          />
        </div>
      </label>

      <label className="text-sm">
        デフォルトID表示形式
        <select
          value={form.defaultIdFormat}
          onChange={(e) => setField('defaultIdFormat', e.target.value as CreateBoardInput['defaultIdFormat'])}
          className="mt-1 w-full rounded border border-border-dark bg-surface-dark-2 px-2 py-1.5"
        >
          <option value="daily_hash">daily_hash (日替わりハッシュ)</option>
          <option value="daily_hash_or_user">daily_hash_or_user</option>
          <option value="api_key_hash">api_key_hash</option>
          <option value="api_key_hash_or_user">api_key_hash_or_user</option>
          <option value="none">none (表示しない)</option>
        </select>
      </label>

      <label className="text-sm">
        デフォルト投稿者名
        <input
          type="text"
          value={form.defaultPosterName}
          onChange={(e) => setField('defaultPosterName', e.target.value)}
          className="mt-1 w-full rounded border border-border-dark bg-surface-dark-2 px-2 py-1.5"
        />
      </label>

      <h2 className="mt-2 text-sm font-semibold text-gray-400">表示設定・上限</h2>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          最大スレッド数 (0=無制限)
          <input
            type="number"
            value={form.maxThreads}
            onChange={(e) => setField('maxThreads', Number(e.target.value))}
            className="mt-1 w-full rounded border border-border-dark bg-surface-dark-2 px-2 py-1.5"
          />
        </label>
        <label className="text-sm">
          スレッドタイトル文字数上限
          <input
            type="number"
            value={form.maxThreadTitleLength}
            onChange={(e) => setField('maxThreadTitleLength', Number(e.target.value))}
            className="mt-1 w-full rounded border border-border-dark bg-surface-dark-2 px-2 py-1.5"
          />
        </label>
        <label className="text-sm">
          デフォルト最大投稿数
          <input
            type="number"
            value={form.defaultMaxPosts}
            onChange={(e) => setField('defaultMaxPosts', Number(e.target.value))}
            className="mt-1 w-full rounded border border-border-dark bg-surface-dark-2 px-2 py-1.5"
          />
        </label>
        <label className="text-sm">
          投稿文字数上限
          <input
            type="number"
            value={form.defaultMaxPostLength}
            onChange={(e) => setField('defaultMaxPostLength', Number(e.target.value))}
            className="mt-1 w-full rounded border border-border-dark bg-surface-dark-2 px-2 py-1.5"
          />
        </label>
        <label className="text-sm">
          投稿行数上限
          <input
            type="number"
            value={form.defaultMaxPostLines}
            onChange={(e) => setField('defaultMaxPostLines', Number(e.target.value))}
            className="mt-1 w-full rounded border border-border-dark bg-surface-dark-2 px-2 py-1.5"
          />
        </label>
        <label className="text-sm">
          投稿者名文字数上限
          <input
            type="number"
            value={form.defaultMaxPosterNameLength}
            onChange={(e) => setField('defaultMaxPosterNameLength', Number(e.target.value))}
            className="mt-1 w-full rounded border border-border-dark bg-surface-dark-2 px-2 py-1.5"
          />
        </label>
        <label className="text-sm">
          メール欄文字数上限
          <input
            type="number"
            value={form.defaultMaxPosterOptionLength}
            onChange={(e) => setField('defaultMaxPosterOptionLength', Number(e.target.value))}
            className="mt-1 w-full rounded border border-border-dark bg-surface-dark-2 px-2 py-1.5"
          />
        </label>
      </div>

      <h2 className="mt-2 text-sm font-semibold text-gray-400">ACL</h2>

      <AclEditor
        label="板のACL"
        value={form.acl}
        onChange={(acl) => setField('acl', acl)}
      />
      <AclEditor
        label="スレッド作成時のデフォルトACL (defaultThreadAcl)"
        value={form.defaultThreadAcl}
        onChange={(defaultThreadAcl) => setField('defaultThreadAcl', defaultThreadAcl)}
      />
      <AclEditor
        label="投稿時のデフォルトACL (defaultPostAcl)"
        value={form.defaultPostAcl}
        onChange={(defaultPostAcl) => setField('defaultPostAcl', defaultPostAcl)}
      />

      <h2 className="mt-2 text-sm font-semibold text-gray-400">NGワード (サーバー側)</h2>
      <NgWordEditor
        value={form.ngWords}
        onChange={(ngWords) => setField('ngWords', ngWords)}
      />

      <Button type="submit" variant="filled" disabled={saving} className="self-start px-4 py-2">
        {saving ? '保存中...' : isEdit ? '更新' : '作成'}
      </Button>
    </form>
  )
}
