// PBKDF2 でパスワードをハッシュ化 (salt付き)。
// 反復回数をハッシュ文字列自体に埋め込むことで、将来 CURRENT_ITERATIONS を引き上げても
// 既存の保存済みハッシュ(古い反復回数で作られたもの)の検証が壊れないようにしている。
const CURRENT_ITERATIONS = 600000
// 反復回数が埋め込まれていない旧形式 ("saltHex:hashHex") のために残す既定値
const LEGACY_ITERATIONS = 100000

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: CURRENT_ITERATIONS }, key, 256)
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('')
  const hashHex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('')
  return `${CURRENT_ITERATIONS}:${saltHex}:${hashHex}`
}

// 定数時間文字列比較 (タイミングサイドチャネル対策)。
// 長さが違う場合も、内容比較にかかる時間が長さに依存して漏れないよう、
// 常に長い方の長さ分だけループする。
function timingSafeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length)
  let diff = a.length === b.length ? 0 : 1
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  }
  return diff === 0
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':')
  // 新形式: "iterations:saltHex:hashHex" / 旧形式: "saltHex:hashHex" (反復回数はLEGACY_ITERATIONS扱い)
  const [iterations, saltHex, hashHex] = parts.length === 3
    ? [parseInt(parts[0], 10) || LEGACY_ITERATIONS, parts[1], parts[2]]
    : [LEGACY_ITERATIONS, parts[0], parts[1]]
  if (!saltHex || !hashHex) return false
  const salt = new Uint8Array((saltHex.match(/.{2}/g) ?? []).map(h => parseInt(h, 16)))
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256)
  const computed = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('')
  return timingSafeEqual(computed, hashHex)
}
