import { useIsMobile } from '../../hooks/useIsMobile'
import MenuBar from './MenuBar'

interface AppShellProps {
  children: React.ReactNode
}

/**
 * PC専用の常設メニューバー(MenuBar)を配置するレイアウト。モバイルでは何もせず
 * children をそのまま返す(モバイルは MobileTopBar / MobileBoardDrawer など
 * 独自のナビを引き続き使う)。
 */
export default function AppShell({ children }: AppShellProps) {
  const isMobile = useIsMobile()

  if (isMobile) return <>{children}</>

  return (
    <div className="flex h-full w-full overflow-hidden bg-c-base">
      <MenuBar />
      <div className="flex-1 min-w-0 overflow-hidden">{children}</div>
    </div>
  )
}
