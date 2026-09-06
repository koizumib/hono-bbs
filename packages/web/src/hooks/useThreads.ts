import { useQuery } from '@tanstack/react-query'
import { getBoardThreads } from '../api/boards'

export function useThreads(boardId: string | undefined) {
  return useQuery({
    queryKey: ['threads', boardId],
    queryFn: () => getBoardThreads(boardId!),
    enabled: !!boardId,
  })
}
