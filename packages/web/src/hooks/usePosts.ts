import { useQuery } from '@tanstack/react-query'
import { getThreadPosts } from '../api/posts'

export function usePosts(boardId: string | undefined, threadId: string | undefined) {
  return useQuery({
    queryKey: ['posts', boardId, threadId],
    queryFn: () => getThreadPosts(boardId!, threadId!),
    enabled: !!boardId && !!threadId,
  })
}
