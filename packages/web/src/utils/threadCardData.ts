import type { Thread } from '../api/types'
import type { HomeThreadCardData } from '../components/home/HomeThreadCard'
import { calculateMomentum } from './momentum'

// ThreadCard.tsx (板の一覧画面) からも同じデータ形状を組み立てられるよう、
// Thread → HomeThreadCardData の変換をここに一本化する
// (TopPage.tsxのお気に入り/未読タブ、板のスレッド一覧「カード表示」の両方で使う)。
export function mapThreadToHomeCardData(
  thread: Thread,
  board?: { name?: string; icon?: string | null; colorTheme?: string | null } | null,
): HomeThreadCardData {
  return {
    boardId: thread.boardId,
    boardName: board?.name ?? thread.boardId,
    boardIcon: board?.icon,
    boardColorTheme: board?.colorTheme,
    threadId: thread.id,
    title: thread.title,
    postCount: thread.postCount,
    momentum: calculateMomentum(thread),
    createdAt: thread.firstPost?.createdAt ?? thread.createdAt,
    opAuthorId: thread.firstPost?.authorId ?? null,
    opPosterName: thread.firstPost?.posterName,
    opPosterOptionInfo: thread.firstPost?.posterOptionInfo,
    opContent: thread.firstPost?.content ?? '',
  }
}
