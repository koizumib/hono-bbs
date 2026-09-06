import { useRef, useState } from 'react'
import { requestUpload, uploadToStorage, confirmUpload } from '../../api/imageUploader'
import { recordImage } from '../../utils/imageHistory'
import { env } from '../../config/env'
import { useTurnstileStore } from '../../stores/turnstileStore'

interface ImageUploadButtonProps {
  onUploaded: (url: string) => void
  className?: string
}

export default function ImageUploadButton({ onUploaded, className }: ImageUploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const turnstileValid = useTurnstileStore((s) => s.isValid())
  const setTurnstileSession = useTurnstileStore((s) => s.setSession)

  if (!env.imageUploaderUrl) return null

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setError(null)

    try {
      if (env.disableTurnstile && !turnstileValid) {
        setTurnstileSession('dev-turnstile-disabled')
      }

      const { imageId, uploadUrl, contentType, deleteToken } = await requestUpload({
        contentType: file.type,
        filename: file.name,
        size: file.size,
      })

      await uploadToStorage(uploadUrl, file, contentType)

      const { url } = await confirmUpload(imageId)

      recordImage({
        imageId,
        deleteToken,
        url,
        originalFilename: file.name.slice(0, 100),
        contentType: file.type,
        size: file.size,
        uploadedAt: Date.now(),
      })

      onUploaded(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'アップロードに失敗しました')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className={className}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => {
          setError(null)
          fileInputRef.current?.click()
        }}
        disabled={isUploading}
        title="画像をアップロード"
        className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <span className="material-symbols-outlined text-sm">
          {isUploading ? 'hourglass_empty' : 'image'}
        </span>
        {isUploading ? 'アップロード中...' : '画像'}
      </button>
      {error && (
        <p className="text-xs text-red-400 mt-0.5">{error}</p>
      )}
    </div>
  )
}
