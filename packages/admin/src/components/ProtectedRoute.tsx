import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

export default function ProtectedRoute() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn())
  if (!isLoggedIn) return <Navigate to="/login" replace />
  return <Outlet />
}
