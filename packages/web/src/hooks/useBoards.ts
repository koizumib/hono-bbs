import { useQuery } from '@tanstack/react-query'
import { getBoards } from '../api/boards'

export function useBoards() {
  return useQuery({
    queryKey: ['boards'],
    queryFn: getBoards,
  })
}
