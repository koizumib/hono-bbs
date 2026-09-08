import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useSearchParams, useNavigate } from 'react-router-dom'
import { useTurnstileStore } from './stores/turnstileStore'
import ProtectedRoute from './components/ProtectedRoute'
import AppShell from './components/layout/AppShell'
import LoginPage from './pages/LoginPage'
import BoardsListPage from './pages/BoardsListPage'
import BoardFormPage from './pages/BoardFormPage'
import ThreadsListPage from './pages/ThreadsListPage'
import PostsListPage from './pages/PostsListPage'
import UsersListPage from './pages/UsersListPage'
import UserDetailPage from './pages/UserDetailPage'
import RolesListPage from './pages/RolesListPage'
import RoleFormPage from './pages/RoleFormPage'
import RoleDetailPage from './pages/RoleDetailPage'
import IpBansListPage from './pages/IpBansListPage'
import ReportsListPage from './pages/ReportsListPage'

// GET /auth/turnstile からのリダイレクト (?setTurnstileToken=<sessionId>) を受け取り、
// turnstileStore に保存してURLから消す (packages/web の App.tsx と同じ仕組み)。
function TurnstileHandler() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const setSession = useTurnstileStore((s) => s.setSession)

  useEffect(() => {
    const token = searchParams.get('setTurnstileToken')
    if (token) {
      setSession(token)
      const url = new URL(window.location.href)
      url.searchParams.delete('setTurnstileToken')
      navigate(url.pathname + url.search, { replace: true })
    }
  }, [searchParams, setSession, navigate])

  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <TurnstileHandler />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route index element={<BoardsListPage />} />
            <Route path="boards" element={<BoardsListPage />} />
            <Route path="boards/new" element={<BoardFormPage />} />
            <Route path="boards/:boardId/edit" element={<BoardFormPage />} />
            <Route path="boards/:boardId/threads" element={<ThreadsListPage />} />
            <Route path="boards/:boardId/threads/:threadId" element={<PostsListPage />} />
            <Route path="users" element={<UsersListPage />} />
            <Route path="users/:id" element={<UserDetailPage />} />
            <Route path="roles" element={<RolesListPage />} />
            <Route path="roles/new" element={<RoleFormPage />} />
            <Route path="roles/:id" element={<RoleDetailPage />} />
            <Route path="ip-bans" element={<IpBansListPage />} />
            <Route path="reports" element={<ReportsListPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
