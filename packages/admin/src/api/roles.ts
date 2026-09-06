import type { InferRequestType } from 'hono/client'
import { client, unwrap, requireSession, requireTurnstileSession } from './rpcClient'
import type { Role, RolesResponse, ApiResponse } from './types'

export async function getRoles(page = 1) {
  requireSession()
  return unwrap<RolesResponse>(client.identity.roles.$get({ query: { page: String(page) } }))
}

export async function getRole(id: string) {
  requireSession()
  return unwrap<ApiResponse<Role>>(client.identity.roles[':id'].$get({ param: { id } }))
}

export type RoleInput = InferRequestType<typeof client.identity.roles.$post>['json']

export async function createRole(input: RoleInput) {
  requireSession()
  requireTurnstileSession()
  return unwrap<ApiResponse<Role>>(client.identity.roles.$post({ json: input }))
}

export async function updateRole(id: string, input: RoleInput) {
  requireSession()
  requireTurnstileSession()
  return unwrap<ApiResponse<Role>>(client.identity.roles[':id'].$put({ param: { id }, json: input }))
}

export async function deleteRole(id: string) {
  requireSession()
  requireTurnstileSession()
  return unwrap<void>(client.identity.roles[':id'].$delete({ param: { id } }))
}

export async function addRoleMember(roleId: string, userId: string) {
  requireSession()
  requireTurnstileSession()
  return unwrap<void>(client.identity.roles[':id'].members.$post({ param: { id: roleId }, json: { userId } }))
}

export async function removeRoleMember(roleId: string, userId: string) {
  requireSession()
  requireTurnstileSession()
  return unwrap<void>(client.identity.roles[':id'].members[':userId'].$delete({ param: { id: roleId, userId } }))
}
