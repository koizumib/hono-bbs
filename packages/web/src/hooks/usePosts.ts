import { useQuery } from '@tanstack/react-query'
import { getThreadPosts } from '../api/posts'
import { withTimeout } from '../utils/withTimeout'

export function usePosts(boardId: string | undefined, threadId: string | undefined) {
  return useQuery({
    queryKey: ['posts', boardId, threadId],
    queryFn: () => withTimeout(getThreadPosts(boardId!, threadId!)),
    enabled: !!boardId && !!threadId,
    // 既に閲覧履歴があるスレッド(=キャッシュ済み)を開いたときも、キャッシュを
    // そのまま出すだけでなく必ず最新のレスがないか確認しにいく
    refetchOnMount: 'always',
    // タブ/アプリのフォーカスが戻っただけで裏で再フェッチされると、ユーザーが
    // 実際にスクロールして読んでいないのに(データ取得=既読、という記録ロジックにより)
    // 一覧側の未読バッジが消えてしまう。フォーカス復帰時の自動再取得は行わない。
    refetchOnWindowFocus: false,
  })
}
