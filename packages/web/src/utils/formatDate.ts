import { formatDistanceToNow, format } from 'date-fns'
import { ja } from 'date-fns/locale'

export function relativeTime(dateStr: string): string {
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: ja })
}

// レス日時表示: 年・曜日・秒・センチ秒は表示しない(月/日 時:分のみ)
export function fullDateTime(dateStr: string): string {
  return format(new Date(dateStr), 'MM/dd HH:mm')
}
