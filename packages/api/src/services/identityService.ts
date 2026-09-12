import { z } from 'zod'
import type { User, Role } from '../types'
import type { DbAdapter } from '../adapters/db'
import type { SystemIds } from '../utils/constants'
import * as userRepository from '../repository/userRepository'
import * as roleRepository from '../repository/roleRepository'
import { hashPassword, verifyPassword } from '../utils/password'
import { PERMISSIONS } from '../utils/permissions'

// ユーザ作成スキーマ (POST /identity/users)
export const createUserSchema = z.object({
  id: z.string().min(7).max(128).regex(/^[a-zA-Z0-9_-]+$/, 'id は英数字・_・- のみ使用できます'),
  displayName: z.string().max(128).optional(),
  password: z.string().min(8).max(128),
})

// GET /identity/users, GET /identity/roles の ?page= クエリ (pageベースページネーション。
// board/thread/postの limit/cursor 方式とは別方式)
export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
})

// POST /identity/roles/:id/members
export const addRoleMemberSchema = z.object({
  userId: z.string().min(1),
})

const updateProfileSchema = z.object({
  displayName: z.string().max(128).optional(),
  bio: z.string().max(500).optional().nullable(),
  email: z.string().email('メールアドレスの形式が正しくありません').max(256).optional().nullable(),
  currentPassword: z.string().min(1).optional(),
  newPassword: z.string().min(8).max(128).optional(),
}).refine(
  d => {
    const hasCurrent = d.currentPassword !== undefined
    const hasNew = d.newPassword !== undefined
    return hasCurrent === hasNew
  },
  { message: 'currentPassword と newPassword は両方指定してください' },
)

// PUT /profile/preferences。中身はクライアント側の設定(テーマ・NGワード等)なので
// サーバー側では解釈・enforceせず、シリアライズ後サイズだけ上限を設ける(ReDoS/ストレージ
// 濫用対策。ACLのような権限に関わる値ではないので厳密な型スキーマは不要)。
const PREFERENCES_MAX_BYTES = 32 * 1024
export const updatePreferencesSchema = z.record(z.string(), z.unknown()).refine(
  (prefs) => new TextEncoder().encode(JSON.stringify(prefs)).length <= PREFERENCES_MAX_BYTES,
  { message: `preferences は ${PREFERENCES_MAX_BYTES} バイト以下にしてください` },
)

export const updateUserAdminSchema = z.object({
  displayName: z.string().max(128).optional(),
  bio: z.string().max(500).optional().nullable(),
  email: z.string().email('メールアドレスの形式が正しくありません').max(256).optional().nullable(),
  isActive: z.boolean().optional(),
  // user-admin-role によるパスワード強制リセット (currentPasswordの確認は不要)
  newPassword: z.string().min(8).max(128).optional(),
})

export const roleSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/, 'ロール名は英数字・_・- のみ使用できます'),
  // isSysAdmin(admin-role)は常に全権限を持つのでここには依らない
  permissions: z.array(z.enum(PERMISSIONS)).default([]),
})

export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>
export type UpdateUserAdminInput = z.infer<typeof updateUserAdminSchema>
export type RoleInput = z.infer<typeof roleSchema>

export function parseCreateUser(data: unknown): CreateUserInput {
  return createUserSchema.parse(data)
}

export function parseUpdateProfile(data: unknown): UpdateProfileInput {
  return updateProfileSchema.parse(data)
}

export function parseUpdatePreferences(data: unknown): UpdatePreferencesInput {
  return updatePreferencesSchema.parse(data)
}

export function parseUpdateUserAdmin(data: unknown): UpdateUserAdminInput {
  return updateUserAdminSchema.parse(data)
}

export function parseRole(data: unknown): RoleInput {
  return roleSchema.parse(data)
}

// ── ユーザ操作 ────────────────────────────────────────────

export async function createUser(
  db: DbAdapter,
  input: CreateUserInput,
  sysIds: SystemIds,
): Promise<User> {
  const existing = await userRepository.findUserById(db, input.id)
  if (existing) throw new Error('USER_ID_TAKEN')

  const now = new Date().toISOString()
  const passwordHash = await hashPassword(input.password)
  const displayName = input.displayName ?? input.id

  // 新規ユーザは generalRole をプライマリロールとして所属させる
  await userRepository.insertUser(db, input.id, displayName, passwordHash, sysIds.generalRoleId, now)
  await roleRepository.insertUserRole(db, input.id, sysIds.generalRoleId)

  return (await userRepository.findUserById(db, input.id))!
}

export async function listUsers(db: DbAdapter, page: number, limit: number): Promise<User[]> {
  return userRepository.listUsers(db, page, limit)
}

export async function getUser(
  db: DbAdapter,
  targetUserId: string,
  requestUserId: string | null,
  isUserAdmin: boolean,
): Promise<User | null> {
  if (!isUserAdmin && requestUserId !== targetUserId) throw new Error('FORBIDDEN')
  return userRepository.findUserById(db, targetUserId)
}

export async function updateProfile(
  db: DbAdapter,
  userId: string,
  input: UpdateProfileInput,
): Promise<User | null> {
  if (input.currentPassword !== undefined && input.newPassword !== undefined) {
    const result = await userRepository.findUserByIdWithHash(db, userId)
    if (!result) throw new Error('USER_NOT_FOUND')
    const ok = await verifyPassword(input.currentPassword, result.passwordHash)
    if (!ok) throw new Error('INVALID_PASSWORD')
    const newHash = await hashPassword(input.newPassword)
    await userRepository.updateUserPassword(db, userId, newHash, new Date().toISOString())
  }

  const now = new Date().toISOString()
  await userRepository.updateUser(db, userId, {
    displayName: input.displayName,
    bio: input.bio,
    email: input.email,
    updatedAt: now,
  })
  return userRepository.findUserById(db, userId)
}

export async function updatePreferences(
  db: DbAdapter,
  userId: string,
  input: UpdatePreferencesInput,
): Promise<User | null> {
  await userRepository.updateUser(db, userId, {
    preferences: input,
    updatedAt: new Date().toISOString(),
  })
  return userRepository.findUserById(db, userId)
}

export async function updateUser(
  db: DbAdapter,
  targetUserId: string,
  input: UpdateUserAdminInput,
  requestUserId: string | null,
  isUserAdmin: boolean,
): Promise<User | null> {
  if (!isUserAdmin && requestUserId !== targetUserId) throw new Error('FORBIDDEN')

  const now = new Date().toISOString()
  const passwordHash = input.newPassword ? await hashPassword(input.newPassword) : undefined
  await userRepository.updateUser(db, targetUserId, {
    displayName: input.displayName,
    bio: input.bio,
    email: input.email,
    isActive: input.isActive,
    passwordHash,
    updatedAt: now,
  })
  return userRepository.findUserById(db, targetUserId)
}

export async function deleteUser(
  db: DbAdapter,
  targetUserId: string,
  sysIds: SystemIds,
): Promise<void> {
  if (targetUserId === sysIds.adminUserId) throw new Error('CANNOT_DELETE_SYSTEM_USER')
  const deleted = await userRepository.deleteUser(db, targetUserId)
  if (!deleted) throw new Error('USER_NOT_FOUND')
}

export async function deleteMe(
  db: DbAdapter,
  userId: string,
  sysIds: SystemIds,
): Promise<void> {
  if (userId === sysIds.adminUserId) throw new Error('CANNOT_DELETE_SYSTEM_USER')
  const deleted = await userRepository.deleteUser(db, userId)
  if (!deleted) throw new Error('USER_NOT_FOUND')
}

// ── ロール操作 ──────────────────────────────────────────

export async function listRoles(db: DbAdapter, page: number, limit: number): Promise<Role[]> {
  return roleRepository.listRoles(db, page, limit)
}

export async function getRole(db: DbAdapter, roleId: string): Promise<Role | null> {
  return roleRepository.findRoleById(db, roleId)
}

export async function createRole(db: DbAdapter, input: RoleInput): Promise<Role> {
  const existing = await roleRepository.findRoleByName(db, input.name)
  if (existing) throw new Error('ROLE_NAME_TAKEN')
  const role: Role = {
    id: crypto.randomUUID(),
    name: input.name,
    permissions: input.permissions,
    createdAt: new Date().toISOString(),
  }
  await roleRepository.insertRole(db, role)
  return role
}

export async function updateRole(
  db: DbAdapter,
  roleId: string,
  input: RoleInput,
  sysIds: SystemIds,
): Promise<Role | null> {
  // システムロールは変更不可
  const systemRoles = [sysIds.userAdminRoleId, sysIds.adminRoleId, sysIds.generalRoleId]
  if (systemRoles.includes(roleId)) throw new Error('CANNOT_MODIFY_SYSTEM_ROLE')
  const updated = await roleRepository.updateRole(db, roleId, { name: input.name, permissions: input.permissions })
  if (!updated) throw new Error('ROLE_NOT_FOUND')
  return roleRepository.findRoleById(db, roleId)
}

export async function deleteRole(
  db: DbAdapter,
  roleId: string,
  sysIds: SystemIds,
): Promise<void> {
  const systemRoles = [sysIds.userAdminRoleId, sysIds.adminRoleId, sysIds.generalRoleId]
  if (systemRoles.includes(roleId)) throw new Error('CANNOT_DELETE_SYSTEM_ROLE')
  const deleted = await roleRepository.deleteRole(db, roleId)
  if (!deleted) throw new Error('ROLE_NOT_FOUND')
}

export async function listRoleMembers(db: DbAdapter, roleId: string, page: number, limit: number): Promise<User[]> {
  const role = await roleRepository.findRoleById(db, roleId)
  if (!role) throw new Error('ROLE_NOT_FOUND')
  return userRepository.listRoleMembers(db, roleId, page, limit)
}

export async function addRoleMember(
  db: DbAdapter,
  roleId: string,
  userId: string,
  sysIds: SystemIds,
  isSysAdmin: boolean,
): Promise<void> {
  // admin-role / user-admin-role への追加はsysadminのみ許可
  // (user-admin-roleしか持たない者が自身/他者をこれらに追加して権限昇格するのを防ぐ)
  if ((roleId === sysIds.adminRoleId || roleId === sysIds.userAdminRoleId) && !isSysAdmin) {
    throw new Error('SYSTEM_ROLE_REQUIRES_SYSADMIN')
  }
  const role = await roleRepository.findRoleById(db, roleId)
  if (!role) throw new Error('ROLE_NOT_FOUND')
  const user = await userRepository.findUserById(db, userId)
  if (!user) throw new Error('USER_NOT_FOUND')
  await roleRepository.insertUserRole(db, userId, roleId)
}

export async function removeRoleMember(
  db: DbAdapter,
  roleId: string,
  userId: string,
  sysIds: SystemIds,
  isSysAdmin: boolean,
): Promise<void> {
  if ((roleId === sysIds.adminRoleId || roleId === sysIds.userAdminRoleId) && !isSysAdmin) {
    throw new Error('SYSTEM_ROLE_REQUIRES_SYSADMIN')
  }
  // 唯一のsysadminを外して誰も管理できなくなる事態を防ぐ
  if (roleId === sysIds.adminRoleId) {
    const memberCount = await roleRepository.countRoleMembers(db, roleId)
    if (memberCount <= 1) throw new Error('CANNOT_REMOVE_LAST_ADMIN')
  }
  const deleted = await roleRepository.deleteUserRole(db, userId, roleId)
  if (!deleted) throw new Error('MEMBER_NOT_FOUND')
}
