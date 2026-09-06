import PostArticle, { type PostHandlers } from '../post/PostArticle'
import type { PopupEntry } from '../post/PostPopup'
import MobileSheet from './MobileSheet'

interface MobilePostPopupProps {
  popups: PopupEntry[]
  anchorCountMap: Map<number, number>
  idCountMap: Map<string, number>
  handlers: PostHandlers
  onCloseTop: () => void
  onCloseAll: () => void
}

/**
 * モバイル用ポップアップ。最上位のポップアップをボトムシートで表示する。
 */
export default function MobilePostPopup({
  popups,
  anchorCountMap,
  idCountMap,
  handlers,
  onCloseTop,
  onCloseAll: _onCloseAll,
}: MobilePostPopupProps) {
  const top = popups[popups.length - 1] ?? null

  return (
    <MobileSheet
      isOpen={popups.length > 0}
      onClose={onCloseTop}
      title={top?.title}
      maxHeight="80vh"
    >
      {top && (
        <div className="p-4 space-y-4">
          {top.posts.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-4">投稿が見つかりません</p>
          ) : (
            top.posts.map((post) => (
              <PostArticle
                key={post.id}
                post={post}
                anchorCount={anchorCountMap.get(post.postNumber) ?? 0}
                idCount={idCountMap.get(post.authorId) ?? 1}
                handlers={handlers}
                isInPopup
              />
            ))
          )}
        </div>
      )}
    </MobileSheet>
  )
}
