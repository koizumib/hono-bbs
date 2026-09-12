// 汎用の画像ダウンロードヘルパー。
// data:/blob: URLはそのまま<a download>で保存できるが、外部ホストの画像URLは
// download属性がcrossorigin制約で無視され新規タブで開かれるだけになることがある。
// fetchでblob化してobjectURL経由にすることで、CORSが許可されている画像は
// 確実にダウンロードできるようにし、CORSで取得できない場合だけ新規タブへ
// フォールバックする。
//
// また、モバイル(特にiOS Safari)は<a download>のdownload属性を無視して
// プレビューを開くだけのことが多く「ダウンロードボタンが効かない」ように見える。
// Web Share API(ファイル共有)に対応していればそちらを優先し、共有シートから
// 確実に「写真に保存」できるようにする。
export async function downloadImageUrl(url: string, filename: string): Promise<void> {
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    triggerDownload(url, filename)
    return
  }
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`)
    const blob = await res.blob()
    await shareOrDownloadBlob(blob, filename)
  } catch {
    // CORS等で取得できない場合は新しいタブで開き、手動で保存してもらう
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

/**
 * 画像/PNG等のBlobを、可能ならWeb Share API(ファイル共有)で共有し、
 * 非対応環境では従来の<a download>方式にフォールバックする。
 * (iOS Safari等、download属性が信頼できない環境向けの救済策)
 */
export async function shareOrDownloadBlob(blob: Blob, filename: string): Promise<void> {
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean
    share?: (data: { files: File[] }) => Promise<void>
  }
  if (nav.canShare && nav.share) {
    const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' })
    if (nav.canShare({ files: [file] })) {
      try {
        await nav.share({ files: [file] })
        return
      } catch (shareErr) {
        // 共有シートをユーザーがキャンセルした場合は何もしない
        if (shareErr instanceof Error && shareErr.name === 'AbortError') return
        // それ以外の共有失敗時は下の<a download>方式にフォールバックする
      }
    }
  }
  const objectUrl = URL.createObjectURL(blob)
  triggerDownload(objectUrl, filename)
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10000)
}

export function triggerDownload(url: string, filename: string): void {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}
