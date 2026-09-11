interface MobileTopBarProps {
  title: string
  subtitle?: string
  /** ハンバーガーメニューを表示（onBack がない場合） */
  onMenuClick?: () => void
  /** 戻るボタンを表示（設定時はメニューより優先） */
  onBack?: () => void
  /** 右端に表示するコンテンツ */
  rightContent?: React.ReactNode
  onTitleClick?: () => void
  /** タイトルを中央寄せにする（板名など） */
  centerTitle?: boolean
}

/**
 * モバイル用トップバー。
 * 左端: 戻るボタン or ハンバーガーメニュー
 * 中央: タイトル
 * 右端: rightContent
 */
export default function MobileTopBar({
  title,
  subtitle,
  onMenuClick,
  onBack,
  rightContent,
  onTitleClick,
  centerTitle,
}: MobileTopBarProps) {
  return (
    <header className="h-[58px] flex-shrink-0 flex items-center px-2.5 gap-1 bg-c-surface border-b border-c-border">
      {/* 左ボタン */}
      <button
        className="p-2 rounded text-slate-400 active:bg-c-accent/10 dark:active:bg-c-accent/20 transition-colors flex-shrink-0"
        onClick={onBack ?? onMenuClick}
      >
        <span className="material-symbols-outlined text-xl">
          {onBack ? 'arrow_back' : 'menu'}
        </span>
      </button>

      {/* タイトル */}
      <div
        className={`flex-1 min-w-0 px-1 ${centerTitle ? 'text-center' : ''}`}
        onClick={onTitleClick}
        style={onTitleClick ? { cursor: 'pointer' } : undefined}
      >
        <p className="text-base font-bold text-slate-900 dark:text-white truncate leading-tight select-none">
          {title}
        </p>
        {subtitle && (
          <p className="text-xs text-slate-500 truncate leading-tight select-none">{subtitle}</p>
        )}
      </div>

      {/* 右コンテンツ */}
      {rightContent && (
        <div className="flex items-center gap-1 flex-shrink-0">{rightContent}</div>
      )}
    </header>
  )
}
