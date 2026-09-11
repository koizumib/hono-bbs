import { useQuery } from '@tanstack/react-query'
import { getBoardThreads } from '../api/boards'
import { withTimeout } from '../utils/withTimeout'

export function useThreads(boardId: string | undefined) {
  return useQuery({
    queryKey: ['threads', boardId],
    queryFn: () => withTimeout(getBoardThreads(boardId!)),
    enabled: !!boardId,
  })
}
