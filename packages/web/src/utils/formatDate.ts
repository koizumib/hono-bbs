import { formatDistanceToNow, format } from 'date-fns'
import { ja } from 'date-fns/locale'

export function relativeTime(dateStr: string): string {
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: ja })
}

export function fullDateTime(dateStr: string, compact = false): string {
  const d = new Date(dateStr)
  if (compact) return format(d, 'MM/dd HH:mm:ss')
  const weekdays = ['日', '月', '火', '水', '木', '金', '土']
  const wd = weekdays[d.getDay()]
  return format(d, `yyyy/MM/dd(${wd}) HH:mm:ss.SS`)
}
