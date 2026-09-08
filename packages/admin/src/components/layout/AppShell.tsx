import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { logout } from '../../api/auth'
import Button from '../ui/Button'

function navLinkClass({ isActive }: { isActive: boolean }) {
  return `block rounded px-3 py-2 text-sm ${isActive ? 'bg-primary text-white' : 'hover:bg-surface-dark-2'}`
}

export default function AppShell() {
  const navigate = useNavigate()
  const displayName = useAuthStore((s) => s.displayName)
  const clearSession = useAuthStore((s) => s.clearSession)

  async function handleLogout() {
    try {
      await logout()
    } catch {
      // 既にセッションが切れていても気にせずローカル状態をクリアする
    }
    clearSession()
    navigate('/login')
  }

  return (
    <div className="flex h-full">
      <nav className="flex w-56 shrink-0 flex-col border-r border-border-dark bg-surface-dark p-4">
        <p className="mb-4 truncate text-sm text-gray-400">{displayName}</p>
        <ul className="flex flex-col gap-1">
          <li><NavLink to="/boards" className={navLinkClass}>板</NavLink></li>
          <li><NavLink to="/users" className={navLinkClass}>ユーザー</NavLink></li>
          <li><NavLink to="/roles" className={navLinkClass}>ロール</NavLink></li>
          <li><NavLink to="/reports" className={navLinkClass}>通報キュー</NavLink></li>
          <li><NavLink to="/ip-bans" className={navLinkClass}>IPBAN</NavLink></li>
        </ul>
        <Button variant="text" onClick={handleLogout} className="mt-auto self-start">
          ログアウト
        </Button>
      </nav>
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
