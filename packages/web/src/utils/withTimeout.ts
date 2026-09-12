// スレッド一覧・スレッド表示のデータ取得が固まって返ってこなくなるのを防ぐための
// 汎用タイムアウトラッパー。指定時間内に解決/拒否されなければ拒否する。
export const FETCH_TIMEOUT_MS = 5000

export function withTimeout<T>(promise: Promise<T>, ms: number = FETCH_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('FETCH_TIMEOUT')), ms)
    promise.then(
      (value) => { clearTimeout(timer); resolve(value) },
      (err) => { clearTimeout(timer); reject(err) },
    )
  })
}
