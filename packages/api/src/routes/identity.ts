import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import type { AppEnv } from '../types'
import {
  listUsersHandler,
  createUserHandler,
  getUserHandler,
  updateUserHandler,
  deleteUserHandler,
  listRolesHandler,
  getRoleHandler,
  createRoleHandler,
  updateRoleHandler,
  deleteRoleHandler,
  addRoleMemberHandler,
  removeRoleMemberHandler,
} from '../handlers/identityHandler'
import {
  createUserSchema,
  updateUserAdminSchema,
  roleSchema,
  pageQuerySchema,
  addRoleMemberSchema,
} from '../services/identityService'
import { requireLogin, requireUserAdminRole } from '../middleware/auth'
import { requireTurnstile } from '../middleware/turnstile'
import { zValidatorHook } from '../utils/zodHelper'

// チェーンで書くことで hc() のRPC型推論にルートスキーマが正しく伝播する (routes/boards.ts と同じ理由)。
const identity = new Hono<AppEnv>()
  // ── ユーザ ──────────────────────────────────────────────
  // POST /users: 誰でも登録可能 (Turnstile 必須、ログイン不要)
  .post('/users', requireTurnstile, zValidator('json', createUserSchema, zValidatorHook), createUserHandler)
  // その他: user-admin-role 必須
  .get('/users', requireLogin, requireUserAdminRole, zValidator('query', pageQuerySchema, zValidatorHook), listUsersHandler)
  .get('/users/:id', requireLogin, requireUserAdminRole, getUserHandler)
  .put('/users/:id', requireLogin, requireUserAdminRole, requireTurnstile, zValidator('json', updateUserAdminSchema, zValidatorHook), updateUserHandler)
  .delete('/users/:id', requireLogin, requireUserAdminRole, requireTurnstile, deleteUserHandler)
  // ── ロール ──────────────────────────────────────────────
  .get('/roles', requireLogin, requireUserAdminRole, zValidator('query', pageQuerySchema, zValidatorHook), listRolesHandler)
  .get('/roles/:id', requireLogin, requireUserAdminRole, getRoleHandler)
  .post('/roles', requireLogin, requireUserAdminRole, requireTurnstile, zValidator('json', roleSchema, zValidatorHook), createRoleHandler)
  .put('/roles/:id', requireLogin, requireUserAdminRole, requireTurnstile, zValidator('json', roleSchema, zValidatorHook), updateRoleHandler)
  .delete('/roles/:id', requireLogin, requireUserAdminRole, requireTurnstile, deleteRoleHandler)
  .post('/roles/:id/members', requireLogin, requireUserAdminRole, requireTurnstile, zValidator('json', addRoleMemberSchema, zValidatorHook), addRoleMemberHandler)
  .delete('/roles/:id/members/:userId', requireLogin, requireUserAdminRole, requireTurnstile, removeRoleMemberHandler)

export default identity
