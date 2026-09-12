import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      // タブを切り替えて戻ってきただけでスレッド一覧/スレッド表示が裏で再取得され、
      // ユーザーが実際に見ていないのに既読/未読の状態が変わってしまうのを防ぐ
      // (取得=既読、という記録ロジックのため)。手動更新や明示的なrefetch()は影響を受けない。
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
