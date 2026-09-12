import type { DbAdapter } from '../adapters/db'
import type { KvAdapter } from '../adapters/kv'
import type { ResourceAcl } from '../types'
import { can } from '../utils/acl'
import { findActiveThreadsForRanking } from '../repository/threadRepository'

// トップページ向け「全板横断の人気スレッド」。1時間毎のCron(index.tsのscheduled())が
// computePopularThreadsを実行してKVに書き込み、GET /popular-threadsはそのKVを読むだけにする
// (リクエストのたびに全スレッドを再集計しない)。KVがまだ無い場合(初回デプロイ直後など)
// だけgetPopularThreadsがその場で計算してKVにも書き込む。
const KV_KEY = 'popular-threads:v1'
// cronの周期(1時間)より長めに持たせ、cronが何らかの理由で止まっていても
// このTTLを過ぎればKVが空になり、次のリクエストがオンデマンド計算で復旧する安全弁にする
const KV_TTL_SECONDS = 2 * 60 * 60
const RESULT_LIMIT = 20

export type PopularThreadEntry = {
  boardId: string
  boardName: string
  threadId: string
  title: string
  postCount: number
  momentum: number
  createdAt: string
  opAuthorId: string | null
  opPosterName: string
  opPosterOptionInfo: string
  // 1レス目の本文(未加工、板のdefaultMaxPostLengthで既にサーバー側の上限が掛かっている)。
  // テキストプレビューの切り詰めや画像URLの抽出はクライアント側(utils/urlExtract.ts)で行う
  // (本文中の画像が140文字目以降にある等で見落とさないよう、ここでは切り詰めない)。
  opContent: string
}

export type PopularThreadsSnapshot = {
  computedAt: string
  items: PopularThreadEntry[]
}

// このスナップショットは全訪問者に同一内容で配信するキャッシュのため、権限チェックは
// 匿名ユーザー基準で集計時に一度だけ行う(配信のたびには行わない)。非公開/制限付きの板・
// スレッドは匿名で読めない=ここには一切現れない、という安全側の挙動になる。
const ANONYMOUS_CTX = { userId: null, userRoleIds: [] as string[], isSysAdmin: false }

// utils/momentum.ts (packages/web) の calculateMomentum と同じ式:
// 勢い = レス数 / 経過時間(時間)。表示側とソート順の基準を揃える。
function calculateMomentum(postCount: number, createdAt: string): number {
  const hours = (Date.now() - new Date(createdAt).getTime()) / 3_600_000
  return postCount / Math.max(0.01, hours)
}

export async function computePopularThreads(db: DbAdapter): Promise<PopularThreadsSnapshot> {
  const rows = await findActiveThreadsForRanking(db)
  const items = rows
    .filter((row) => {
      const boardAcl = JSON.parse(row.board_acl) as ResourceAcl
      const threadAcl = JSON.parse(row.thread_acl) as ResourceAcl
      return can(boardAcl, ANONYMOUS_CTX, 'read') && can(threadAcl, ANONYMOUS_CTX, 'read')
    })
    .map((row) => ({
      boardId: row.board_id,
      boardName: row.board_name,
      threadId: row.thread_id,
      title: row.title,
      postCount: row.post_count,
      momentum: calculateMomentum(row.post_count, row.created_at),
      createdAt: row.created_at,
      // 1レス目が削除済みの場合はID・名前・本文を見せない(maskDeletedPostと同じ方針)
      opAuthorId: row.op_is_deleted ? null : row.op_author_id,
      opPosterName: row.op_is_deleted ? '' : (row.op_poster_name ?? ''),
      opPosterOptionInfo: row.op_is_deleted ? '' : (row.op_poster_option_info ?? ''),
      opContent: row.op_is_deleted ? '' : (row.op_content ?? ''),
    }))
    .sort((a, b) => b.momentum - a.momentum)
    .slice(0, RESULT_LIMIT)

  return { computedAt: new Date().toISOString(), items }
}

// Cronから呼ぶ: 再集計してKVを更新する
export async function refreshPopularThreads(db: DbAdapter, kv: KvAdapter): Promise<PopularThreadsSnapshot> {
  const snapshot = await computePopularThreads(db)
  await kv.put(KV_KEY, JSON.stringify(snapshot), { expirationTtl: KV_TTL_SECONDS })
  return snapshot
}

// GET /popular-threads から呼ぶ: KVにあればそれを返すだけ。無ければその場で計算してKVにも
// 書き込む(以後のリクエストは次のCron実行まで、あるいはTTL切れまで再計算しない)。
export async function getPopularThreads(db: DbAdapter, kv: KvAdapter): Promise<PopularThreadsSnapshot> {
  const cached = await kv.get<PopularThreadsSnapshot>(KV_KEY, 'json')
  if (cached) return cached
  return refreshPopularThreads(db, kv)
}
