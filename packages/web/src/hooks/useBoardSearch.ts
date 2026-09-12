import { useQuery } from '@tanstack/react-query'
import { getBoards } from '../api/boards'

export function useBoardSearch(q: string, category: string, sort: 'newest' | 'popular') {
  return useQuery({
    queryKey: ['boards', 'search', q, category, sort],
    queryFn: () => getBoards({ limit: 100, q: q || undefined, category: category || undefined, sort }),
  })
}
