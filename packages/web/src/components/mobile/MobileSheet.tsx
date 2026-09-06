import { createPortal } from 'react-dom'

interface MobileSheetProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  /** シートの最大高さ（デフォルト: '90vh'） */
  maxHeight?: string
}

/**
 * モバイル用ボトムシート。
 * ポータルを使って body 直下に描画する。
 */
export default function MobileSheet({
  isOpen,
  onClose,
  title,
  children,
  maxHeight = '90vh',
}: MobileSheetProps) {
  return createPortal(
    <div
      className="fixed inset-0 z-[9000]"
      style={{
        pointerEvents: isOpen ? 'auto' : 'none',
      }}
    >
      {/* バックドロップ */}
      <div
        className="absolute inset-0 bg-black/60 transition-opacity duration-200"
        style={{ opacity: isOpen ? 1 : 0 }}
        onClick={onClose}
      />

      {/* シート本体 */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-c-surface rounded-t-2xl flex flex-col border-t border-c-border"
        style={{
          maxHeight,
          transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 250ms cubic-bezier(0.32, 0.72, 0, 1)',
          willChange: 'transform',
        }}
      >
        {/* ドラッグハンドル */}
        <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-slate-400/40 rounded-full" />
        </div>

        {title && (
          <div className="px-4 py-2 flex items-center justify-between border-b border-c-border flex-shrink-0">
            <span className="font-bold text-slate-800 dark:text-white text-sm">{title}</span>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
        )}

        <div className="overflow-y-auto custom-scrollbar flex-1 min-h-0">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
