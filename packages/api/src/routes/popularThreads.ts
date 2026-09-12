import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { getPopularThreadsHandler } from '../handlers/popularThreadsHandler'

// hc<AppType>() のRPC型推論スコープには含めない (rpcType.ts はboards系のみに絞る方針、
// CLAUDE.md参照)。packages/web からはauth/identity/profile同様、手書きのapiFetchで叩く。
const popularThreads = new Hono<AppEnv>()
  .get('/', getPopularThreadsHandler)

export default popularThreads
