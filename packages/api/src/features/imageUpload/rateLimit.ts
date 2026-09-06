import { createCloudflareKvAdapter } from '../../adapters/kv'
import { checkAndRecord as sharedCheckAndRecord } from '../../middleware/rateLimit'

// imageUploadは専用のIMAGE_KV(任意設定)にレート制限カウンタを保存する。
// 判定ロジック自体は middleware/rateLimit.ts の共通実装に委譲する。
export async function checkAndRecord(
  kv: KVNamespace | undefined,
  identifier: string,
  limitStr: string | undefined,
  windowStr: string | undefined,
): Promise<boolean> {
  if (!kv) return true
  return sharedCheckAndRecord(createCloudflareKvAdapter(kv), 'ratelimit', identifier, limitStr, windowStr)
}
