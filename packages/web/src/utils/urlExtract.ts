const IMAGE_EXT_RE = /\.(png|jpg|jpeg|gif|webp|bmp|svg)(?=[?#]|$)/i
const URL_RE = /https?:\/\/[^\s<>"]+/g

export type MediaType = 'image' | 'youtube' | 'twitter' | 'url'

export interface ExtractedMedia {
  url: string
  type: MediaType
  videoId?: string
}

export function classifyUrl(url: string): MediaType {
  const path = url.split(/[?#]/)[0]
  if (IMAGE_EXT_RE.test(path)) return 'image'
  if (/(?:twitter\.com|x\.com)/i.test(url)) return 'twitter'
  if (/(?:youtube\.com|youtu\.be)/i.test(url)) return 'youtube'
  return 'url'
}

export function getYouTubeVideoId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?.*v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return m ? m[1] : null
}

export function extractMedia(text: string): ExtractedMedia[] {
  const urls = text.match(URL_RE) ?? []
  return urls.map((url) => {
    const type = classifyUrl(url)
    if (type === 'youtube') {
      const videoId = getYouTubeVideoId(url)
      return { url, type, ...(videoId ? { videoId } : {}) }
    }
    return { url, type }
  })
}

export function hasMedia(text: string): boolean {
  const media = extractMedia(text)
  return media.some((m) => m.type === 'image' || m.type === 'youtube')
}
