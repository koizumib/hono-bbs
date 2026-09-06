import { Hono } from 'hono'
import type { AppEnv } from './types'
import boards from './routes/boards'

// packages/web が hc<AppType>() で型だけをimportするための、エクスポート専用ファイル。
// このインスタンスはマウント・起動は一切されない (型を確定させるためだけの入れ物)。
// auth/identity/profile/images は今回のRPC化のスコープ外なので、意図的にこのファイルには
// 含めない (含めるとそれらのハンドラの実装までpackages/webのtsc実行時にチェック対象へ
// 引き込まれてしまうため、このファイルは import グラフを boards/threads/posts 系だけに
// 絞るために app.ts とは別ファイルにしている)。
// (packages/api/package.json の "types" フィールドがこのファイルを指す)
const rpcApp = new Hono<AppEnv>().route('/boards', boards)

export type AppType = typeof rpcApp
