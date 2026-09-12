import { useEffect, useRef } from 'react'

/**
 * モーダル/ライトボックスが開いている間だけ history に1エントリ積んでおき、
 * ブラウザ/OSの「戻る」ジェスチャーやハードウェア戻るボタンが押されたときに
 * ページごと(スレッド一覧まで)戻ってしまうのではなく、このモーダルを
 * 閉じるだけにする。
 *
 * 例: スレッド内の画像を直感的に「戻るジェスチャー」で閉じようとすると、
 * 画像だけでなくスレッドそのものから抜けてしまう問題への対策。
 */
export function useBackGestureClose(isOpen: boolean, onClose: () => void): void {
  const pushedRef = useRef(false)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!isOpen) return
    window.history.pushState({ modalBackGuard: true }, '')
    pushedRef.current = true

    const onPopState = () => {
      pushedRef.current = false
      onCloseRef.current()
    }
    window.addEventListener('popstate', onPopState)

    return () => {
      window.removeEventListener('popstate', onPopState)
      // ×ボタン/背景タップなど通常操作で閉じた場合は、積んでおいた履歴エントリを消費する
      if (pushedRef.current) {
        pushedRef.current = false
        window.history.back()
      }
    }
  }, [isOpen])
}
