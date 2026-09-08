import { Hono } from 'hono'
import type { AppEnv } from './types'
import boards from './routes/boards'
import identity from './routes/identity'
import auth from './routes/auth'
import moderation from './routes/moderation'

// packages/admin が hc<AdminAppType>() で型だけをimportするための、エクスポート専用ファイル。
// このインスタンスはマウント・起動は一切されない (型を確定させるためだけの入れ物)。
// packages/web 向けの rpcType.ts (boards のみ) とは別ファイルにして、packages/web の
// 型チェック範囲を広げないようにしている。profile/images は管理画面のスコープ外なので含めない。
// (packages/api/package.json の "exports"."./admin" がこのファイルを指す)
const rpcAdminApp = new Hono<AppEnv>()
  .route('/boards', boards)
  .route('/identity', identity)
  .route('/auth', auth)
  .route('/moderation', moderation)

export type AdminAppType = typeof rpcAdminApp
