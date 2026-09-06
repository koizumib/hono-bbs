import { z } from 'zod'

// カーソルベースページネーション共通ユーティリティ。
// カーソルは「不透明な文字列」として扱う (中身の形式はクライアントに公開しない)。
// Cloudflare Workers ランタイムに Buffer が無いため、Web標準の btoa/atob + TextEncoder/Decoder で実装する。

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/')
  const base64 = padded + '='.repeat((4 - (padded.length % 4)) % 4)
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function encodeCursor(value: Record<string, unknown>): string {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(value)))
}

export function decodeCursor<T>(cursor: string): T | null {
  try {
    return JSON.parse(new TextDecoder().decode(fromBase64Url(cursor))) as T
  } catch {
    return null
  }
}

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
})

export type PaginationQuery = z.infer<typeof paginationQuerySchema>

export function parsePaginationQuery(query: Record<string, string | undefined>): PaginationQuery {
  return paginationQuerySchema.parse(query)
}

export type Page<T> = {
  items: T[]
  nextCursor: string | null
}
