import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useSearchParams, useNavigate } from 'react-router-dom'
import { useTurnstileStore } from './stores/turnstileStore'
import { useSettingsStore } from './stores/settingsStore'
import { useSettingsSync } from './hooks/useSettingsSync'
import { useIsMobile } from './hooks/useIsMobile'
import { env } from './config/env'
import MainBoardPage from './pages/MainBoardPage'
import MobileBoardPage from './pages/MobileBoardPage'
import NewThreadPage from './pages/NewThreadPage'
import SettingsPage from './pages/SettingsPage'
import RegisterPage from './pages/RegisterPage'
import TopPage from './pages/TopPage'
import BoardSearchPage from './pages/BoardSearchPage'
import BoardAboutPage from './pages/BoardAboutPage'
import AppShell from './components/layout/AppShell'

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

function SettingsSyncHandler() {
  useSettingsSync()
  return null
}


// document.title と favicon を env から設定
document.title = env.appName
if (env.appFavicon) {
  const link = document.querySelector<HTMLLinkElement>("link[rel='icon']")
  if (link) link.href = env.appFavicon
}

const FONT_SIZES = [13, 14, 16, 18, 20]

// indigo/amber-teal はダーク系、indigo-light/amber-teal-light はライト系。
// 既存の大量の Tailwind dark: バリアントを引き続き使えるよう、カラースキームの
// トークン(data-scheme)とは別に、ダーク/ライトの判定だけ従来通り.darkクラスで
// 引き継ぐ。
const DARK_SCHEMES = new Set(['indigo', 'amber-teal'])

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useSettingsStore((s) => s.scheme)
  const pattern = useSettingsStore((s) => s.pattern)
  const fontSize = useSettingsStore((s) => s.fontSize)

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-scheme', scheme)
    root.classList.toggle('dark', DARK_SCHEMES.has(scheme))
  }, [scheme])

  useEffect(() => {
    document.documentElement.setAttribute('data-pattern', pattern)
  }, [pattern])

  useEffect(() => {
    document.documentElement.style.fontSize = `${FONT_SIZES[fontSize - 1]}px`
  }, [fontSize])

  return <>{children}</>
}

// AppShell(常設トップバー+レール)配下のページ。NewThreadPage/RegisterPageは
// h-screenの独立した全画面フローのため、意図的にAppShellの外に置く(下記参照)。
function ShellRoutes() {
  const isMobile = useIsMobile()
  const BoardPage = isMobile ? MobileBoardPage : MainBoardPage
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<TopPage />} />
        <Route path="/boards" element={<BoardSearchPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/:boardId/about" element={<BoardAboutPage />} />
        <Route path="/:boardId" element={<BoardPage />} />
        <Route path="/:boardId/:threadId" element={<BoardPage />} />
      </Routes>
    </AppShell>
  )
}

function BoardRoutes() {
  return (
    <Routes>
      <Route path="/new-thread/:boardId" element={<NewThreadPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/*" element={<ShellRoutes />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <TurnstileHandler />
        <SettingsSyncHandler />
        <BoardRoutes />
      </ThemeProvider>
    </BrowserRouter>
  )
}
