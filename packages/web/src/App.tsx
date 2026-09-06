import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useSearchParams, useNavigate } from 'react-router-dom'
import { useTurnstileStore } from './stores/turnstileStore'
import { useSettingsStore } from './stores/settingsStore'
import { ACCENT_MAP } from './theme/accentColors'
import { useIsMobile } from './hooks/useIsMobile'
import { env } from './config/env'
import MainBoardPage from './pages/MainBoardPage'
import MobileBoardPage from './pages/MobileBoardPage'
import NewThreadPage from './pages/NewThreadPage'
import SettingsPage from './pages/SettingsPage'
import RegisterPage from './pages/RegisterPage'

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


// document.title と favicon を env から設定
document.title = env.appName
if (env.appFavicon) {
  const link = document.querySelector<HTMLLinkElement>("link[rel='icon']")
  if (link) link.href = env.appFavicon
}

const FONT_SIZES = [13, 14, 16, 18, 20]

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSettingsStore((s) => s.theme)
  const accentColor = useSettingsStore((s) => s.accentColor)
  const fontSize = useSettingsStore((s) => s.fontSize)

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('dark', 'light-gray', 'gray', 'dark-gray')

    if (theme === 'dark') {
      root.classList.add('dark')
    } else if (theme === 'dark-gray') {
      root.classList.add('dark', 'dark-gray')
    } else if (theme === 'light-gray') {
      root.classList.add('light-gray')
    } else if (theme === 'gray') {
      root.classList.add('gray')
    } else if (theme === 'auto') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      if (mq.matches) root.classList.add('dark')
      else root.classList.remove('dark')
    }
  }, [theme])

  useEffect(() => {
    const c = ACCENT_MAP[accentColor]
    const root = document.documentElement
    root.style.setProperty('--c-accent', c.base)
    root.style.setProperty('--c-accent-hover', c.hover)
    root.style.setProperty('--c-accent-text', c.text)
  }, [accentColor])

  useEffect(() => {
    document.documentElement.style.fontSize = `${FONT_SIZES[fontSize - 1]}px`
  }, [fontSize])

  return <>{children}</>
}

function BoardRoutes() {
  const isMobile = useIsMobile()
  const BoardPage = isMobile ? MobileBoardPage : MainBoardPage
  return (
    <Routes>
      <Route path="/" element={<BoardPage />} />
      <Route path="/:boardId" element={<BoardPage />} />
      <Route path="/:boardId/:threadId" element={<BoardPage />} />
      <Route path="/new-thread/:boardId" element={<NewThreadPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/register" element={<RegisterPage />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <TurnstileHandler />
        <BoardRoutes />
      </ThemeProvider>
    </BrowserRouter>
  )
}
