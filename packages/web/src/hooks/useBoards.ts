import { useQuery } from '@tanstack/react-query'
import { getBoards } from '../api/boards'

export function useBoards() {
  return useQuery({
    queryKey: ['boards'],
    // サイドバー/ドロワー/設定ページの板一覧表示で使うため、API上限いっぱいまで取得する
    // (デフォルトの20件だと板数が多い場合に一部の板が表示されなくなってしまうため)
    queryFn: () => getBoards({ limit: 100 }),
  })
}
