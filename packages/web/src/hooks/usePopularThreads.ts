import { useQuery } from '@tanstack/react-query'
import { getPopularThreads } from '../api/popularThreads'

// サーバー側で1時間毎に再集計されたキャッシュを読むだけなので、クライアント側も
// 短時間で何度も再取得する必要はない(staleTimeを長めに取る)
export function usePopularThreads() {
  return useQuery({
    queryKey: ['popular-threads'],
    queryFn: getPopularThreads,
    staleTime: 5 * 60 * 1000,
  })
}
