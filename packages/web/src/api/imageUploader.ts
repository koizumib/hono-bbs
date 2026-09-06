import { env } from '../config/env'
import { useTurnstileStore } from '../stores/turnstileStore'

export interface UploadRequestResponse {
  imageId: string
  uploadUrl: string
  uploadUrlExpiresAt: string
  contentType: string
  deleteToken: string
}

export interface ImageRecord {
  id: string
  storageKey: string
  originalFilename: string | null
  contentType: string
  size: number | null
  status: 'pending' | 'active' | 'reported'
  turnstileSessionId: string | null
  reportCount: number
  createdAt: string
  confirmedAt: string | null
  expiresAt: string | null
}

export interface ConfirmUploadResponse {
  image: ImageRecord
  url: string
}

async function uploaderPost(path: string, body?: unknown): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const turnstileSessionId = useTurnstileStore.getState().sessionId
  if (turnstileSessionId) {
    headers['X-Turnstile-Session'] = turnstileSessionId
  }
  return fetch(`${env.imageUploaderUrl}${path}`, {
    method: 'POST',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

export async function requestUpload(params: {
  contentType: string
  filename?: string
  size?: number
}): Promise<UploadRequestResponse> {
  const res = await uploaderPost('/upload/request', params)
  const json = await res.json() as { data?: UploadRequestResponse; message?: string }
  if (!res.ok) throw new Error(json.message ?? 'アップロードリクエストに失敗しました')
  return json.data!
}

export async function uploadToStorage(uploadUrl: string, file: File, contentType: string): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  })
  if (!res.ok) throw new Error('ストレージへのアップロードに失敗しました')
}

export async function confirmUpload(imageId: string): Promise<ConfirmUploadResponse> {
  const res = await uploaderPost(`/upload/confirm/${imageId}`)
  const json = await res.json() as { data?: ConfirmUploadResponse; message?: string }
  if (!res.ok) throw new Error(json.message ?? 'アップロード確認に失敗しました')
  return json.data!
}

export async function deleteImage(imageId: string, deleteToken: string): Promise<void> {
  const res = await fetch(`${env.imageUploaderUrl}/images/${imageId}/${deleteToken}`, {
    method: 'DELETE',
  })
  if (res.status === 204) return
  if (!res.ok) {
    const json = await res.json().catch(() => ({})) as { message?: string }
    throw new Error(json.message ?? '削除に失敗しました')
  }
}
