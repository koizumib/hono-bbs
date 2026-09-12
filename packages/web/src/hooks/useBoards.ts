import { useQuery } from '@tanstack/react-query'
import { getAllBoards } from '../api/boards'

export function useBoards() {
  return useQuery({
    queryKey: ['boards'],
    // サイドバー/メニューバー/トップページの板一覧表示で使うため、板数が1ページ(100件)を
    // 超えても欠けが出ないよう全ページ取得する
    queryFn: getAllBoards,
  })
}
