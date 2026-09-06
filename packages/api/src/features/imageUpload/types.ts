export type ImageStatus = 'pending' | 'active' | 'reported' | 'deleted'

export type Image = {
  id: string
  storageKey: string
  originalFilename: string | null
  contentType: string
  size: number | null
  status: ImageStatus
  turnstileSessionId: string | null
  reportCount: number
  createdAt: string
  confirmedAt: string | null
  expiresAt: string | null
}
