import type { Context } from 'hono'
import type { AppEnv } from '../../types'
import * as presign from './presign'
import * as repository from './repository'
import * as rateLimit from './rateLimit'
import { getClientIp } from '../../utils/clientIp'

const DEFAULT_ALLOWED_TYPES = 'image/jpeg,image/png,image/gif,image/webp'

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
}

function getStorageConfig(env: AppEnv['Bindings']): presign.StorageConfig {
  return {
    endpoint: env.S3_ENDPOINT ?? '',
    bucket: env.S3_BUCKET ?? '',
    region: env.S3_REGION ?? '',
    accessKeyId: env.S3_ACCESS_KEY_ID ?? '',
    secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? '',
  }
}

function buildPublicUrl(env: AppEnv['Bindings'], storageKey: string): string {
  return `${(env.IMAGE_PUBLIC_BASE_URL ?? '').replace(/\/$/, '')}/${storageKey}`
}

// turnstileSessionId は投稿者を特定・なりすませる情報のため、完全に公開の
// GET/confirm レスポンスには含めない (この2エンドポイントは未ログインの誰でも呼べる)
function stripImage<T extends { turnstileSessionId: string | null }>(image: T): Omit<T, 'turnstileSessionId'> {
  const { turnstileSessionId: _dropped, ...rest } = image
  return rest
}

// POST /upload/request
// Presigned PUT URL を発行する (Turnstile + レート制限チェック)
export async function requestUploadHandler(c: Context<AppEnv>): Promise<Response> {
  // レート制限: Turnstile セッション ID または IP を識別子として使用
  // checkAndRecord は判定と記録を同時に行う (Sliding Window Log 方式)
  const turnstileSessionId = c.req.header('X-Turnstile-Session') ?? null
  const identifier = turnstileSessionId ?? getClientIp(c) ?? 'unknown'
  const allowed = await rateLimit.checkAndRecord(
    c.env.IMAGE_KV, identifier, c.env.UPLOAD_RATE_LIMIT, c.env.UPLOAD_RATE_WINDOW,
  )
  if (!allowed) {
    return c.json({ error: 'RATE_LIMIT_EXCEEDED', message: 'Upload rate limit exceeded' }, 429)
  }

  let body: { filename?: string; contentType?: string; size?: number }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'VALIDATION_ERROR', message: 'Invalid JSON body' }, 400)
  }

  if (!body.contentType) {
    return c.json({ error: 'VALIDATION_ERROR', message: 'contentType is required' }, 400)
  }
  // sizeは実アップロードのContent-Lengthとして署名に含めるため必須にする
  // (未指定だと実際にアップロードされるバイト数を一切拘束できず、上限チェックが無意味になる)
  if (!body.size || body.size <= 0 || !Number.isInteger(body.size)) {
    return c.json({ error: 'VALIDATION_ERROR', message: 'size (positive integer bytes) is required' }, 400)
  }

  // 許可された MIME タイプのチェック
  const allowedTypes = (c.env.ALLOWED_CONTENT_TYPES ?? DEFAULT_ALLOWED_TYPES)
    .split(',').map(t => t.trim()).filter(Boolean)
  if (!allowedTypes.includes(body.contentType)) {
    return c.json({ error: 'INVALID_CONTENT_TYPE', message: `Allowed types: ${allowedTypes.join(', ')}` }, 400)
  }

  // ファイルサイズ上限チェック。MAX_IMAGE_SIZE が未設定のときは既定10MBを適用する
  // (明示的に"0"を設定した運用者だけが無制限を選べる — レート制限と同じ考え方)
  const DEFAULT_MAX_IMAGE_SIZE = 10 * 1024 * 1024
  const maxSize = c.env.MAX_IMAGE_SIZE === undefined
    ? DEFAULT_MAX_IMAGE_SIZE
    : parseInt(c.env.MAX_IMAGE_SIZE, 10) || 0
  if (maxSize > 0 && body.size > maxSize) {
    return c.json({ error: 'FILE_TOO_LARGE', message: `Max file size: ${maxSize} bytes` }, 400)
  }

  const imageId = crypto.randomUUID()
  const ext = MIME_TO_EXT[body.contentType] ?? ''
  const storageKey = `images/${imageId}${ext}`
  const expiresIn = Math.max(60, parseInt(c.env.PRESIGNED_URL_TTL ?? '300', 10) || 300)
  // content-lengthを申告サイズで署名することで、実アップロード時にストレージ側(R2/S3)が
  // バイト数の不一致を検出してPUT自体を拒否するようになる (申告値だけを信じない)
  const uploadUrl = await presign.generatePresignedPutUrl(
    getStorageConfig(c.env), storageKey, body.contentType, expiresIn, body.size,
  )

  const now = new Date()
  const ttlDays = parseInt(c.env.IMAGE_TTL_DAYS ?? '0', 10)
  const expiresAt = ttlDays > 0
    ? new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000).toISOString()
    : null

  const deleteToken = crypto.randomUUID()

  await repository.createImage(c.env.DB!, {
    id: imageId,
    storageKey,
    originalFilename: body.filename ?? null,
    contentType: body.contentType,
    size: body.size ?? null,
    status: 'pending',
    turnstileSessionId,
    reportCount: 0,
    createdAt: now.toISOString(),
    confirmedAt: null,
    expiresAt,
  }, deleteToken)

  const uploadUrlExpiresAt = new Date(now.getTime() + expiresIn * 1000).toISOString()
  // deleteToken はこのレスポンスでのみ返す。保管しておくことで投稿者自身が削除できる
  return c.json({ data: { imageId, uploadUrl, uploadUrlExpiresAt, contentType: body.contentType, deleteToken } }, 201)
}

// 実バイト列の先頭がcontentTypeと矛盾しないか(マジックナンバー)を確認する。
// 署名付きURLはcontent-typeヘッダーの値を拘束するだけで、実際に送られたバイト列の中身までは
// 検証できないため、ここで「PNGと申告してPNGで始まらないファイル」等を弾く。
// 未知のcontentType(許可リストにない)は素通り — ALLOWED_CONTENT_TYPESの検証は
// requestUploadHandler側の役割なのでここでは重複させない。
const MAGIC_NUMBER_CHECKS: Record<string, (bytes: Uint8Array) => boolean> = {
  'image/jpeg': (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47
    && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  'image/gif': (b) => b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38,
  'image/webp': (b) => b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46
    && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
}

async function verifyMagicNumber(env: AppEnv['Bindings'], image: { storageKey: string; contentType: string }): Promise<boolean> {
  const check = MAGIC_NUMBER_CHECKS[image.contentType]
  if (!check) return true // 未知のcontentTypeは対象外 (許可リスト側で既に弾かれている前提)
  const res = await fetch(buildPublicUrl(env, image.storageKey), { headers: { Range: 'bytes=0-15' } })
  if (!res.ok) return false
  const bytes = new Uint8Array(await res.arrayBuffer())
  return check(bytes)
}

// POST /upload/confirm/:imageId
// アップロード完了を通知し、ステータスを pending → active に遷移する
export async function confirmUploadHandler(c: Context<AppEnv>): Promise<Response> {
  const imageId = c.req.param('imageId')
  const image = await repository.findImageById(c.env.DB!, imageId)
  if (!image) return c.json({ error: 'NOT_FOUND', message: 'Image not found' }, 404)

  if (image.status === 'active') {
    // 二重 confirm は冪等に成功を返す
    return c.json({ data: { image: stripImage(image), url: buildPublicUrl(c.env, image.storageKey) } })
  }
  if (image.status !== 'pending') {
    return c.json({ error: 'INVALID_STATUS', message: `Image status is ${image.status}` }, 409)
  }

  if (!(await verifyMagicNumber(c.env, image))) {
    // 申告したcontentTypeと実際のバイト列が矛盾する = 偽装アップロード。保存済みオブジェクトごと削除する
    try {
      await presign.deleteObject(getStorageConfig(c.env), image.storageKey)
    } catch (e) {
      console.error('[ConfirmUpload] Storage delete failed for rejected upload:', e)
    }
    await repository.deleteImageRow(c.env.DB!, imageId)
    return c.json({ error: 'CONTENT_MISMATCH', message: 'Uploaded file does not match declared content type' }, 422)
  }

  const confirmedAt = new Date().toISOString()
  await repository.confirmImage(c.env.DB!, imageId, confirmedAt)
  const confirmed = { ...image, status: 'active' as const, confirmedAt }
  return c.json({ data: { image: stripImage(confirmed), url: buildPublicUrl(c.env, image.storageKey) } })
}

// GET /images/:imageId
export async function getImageHandler(c: Context<AppEnv>): Promise<Response> {
  const imageId = c.req.param('imageId')
  const image = await repository.findImageById(c.env.DB!, imageId)
  if (!image || image.status === 'deleted') {
    return c.json({ error: 'NOT_FOUND', message: 'Image not found' }, 404)
  }
  return c.json({ data: { image: stripImage(image), url: buildPublicUrl(c.env, image.storageKey) } })
}

// POST /images/:imageId/report
// 画像を通報する (active/reported な画像のみ)
export async function reportImageHandler(c: Context<AppEnv>): Promise<Response> {
  const imageId = c.req.param('imageId')
  const image = await repository.findImageById(c.env.DB!, imageId)
  if (!image || image.status === 'deleted' || image.status === 'pending') {
    return c.json({ error: 'NOT_FOUND', message: 'Image not found' }, 404)
  }
  await repository.reportImage(c.env.DB!, imageId)
  return c.json({ data: { message: 'Image reported' } })
}

// DELETE /images/:imageId (管理者のみ)
// ストレージと DB 行の両方を削除する
export async function deleteImageHandler(c: Context<AppEnv>): Promise<Response> {
  const imageId = c.req.param('imageId')
  const image = await repository.findImageById(c.env.DB!, imageId)
  if (!image || image.status === 'deleted') {
    return c.json({ error: 'NOT_FOUND', message: 'Image not found' }, 404)
  }

  try {
    await presign.deleteObject(getStorageConfig(c.env), image.storageKey)
  } catch (e) {
    console.error('[Admin] Storage delete failed:', e)
    return c.json({ error: 'STORAGE_ERROR', message: 'Failed to delete from storage' }, 500)
  }

  await repository.deleteImageRow(c.env.DB!, imageId)
  return new Response(null, { status: 204 })
}

// DELETE /images/:imageId/:deleteToken (投稿者自身による削除)
// アップロード時に返した deleteToken を URL に含めることで削除できる
export async function userDeleteImageHandler(c: Context<AppEnv>): Promise<Response> {
  const imageId = c.req.param('imageId')
  const deleteToken = c.req.param('deleteToken')
  const image = await repository.findImageByDeleteToken(c.env.DB!, imageId, deleteToken)
  if (!image || image.status === 'deleted') {
    return c.json({ error: 'NOT_FOUND', message: 'Image not found' }, 404)
  }

  try {
    await presign.deleteObject(getStorageConfig(c.env), image.storageKey)
  } catch (e) {
    console.error('[UserDelete] Storage delete failed:', e)
    return c.json({ error: 'STORAGE_ERROR', message: 'Failed to delete from storage' }, 500)
  }

  await repository.deleteImageRow(c.env.DB!, imageId)
  return new Response(null, { status: 204 })
}
