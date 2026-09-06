import type { AccentColor } from '../stores/settingsStore'

/**
 * アクセントカラー定義
 *
 * 各色の設定:
 *   base  : メインカラー
 *   hover : ホバー時カラー
 *   text  : アクセント色背景上のテキスト色（白 or 暗い色）
 *
 * ここで定義した値は CSS変数 --c-accent / --c-accent-hover / --c-accent-text に注入されます。
 * src/theme/theme.css の ":root" の初期値も合わせて更新してください。
 */
export const ACCENT_MAP: Record<AccentColor, { base: string; hover: string; text: string }> = {
  blue:   { base: '#2563eb', hover: '#1d4ed8', text: '#ffffff' },
  yellow: { base: '#ffd400', hover: '#e6bf00', text: '#1f2937' },
  pink:   { base: '#f91880', hover: '#d4166e', text: '#ffffff' },
  purple: { base: '#7856ff', hover: '#6548db', text: '#ffffff' },
  orange: { base: '#ff7a00', hover: '#d96900', text: '#ffffff' },
  green:  { base: '#00ba7c', hover: '#009e69', text: '#ffffff' },
}
