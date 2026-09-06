import type { ButtonHTMLAttributes } from 'react'

type Variant = 'filled' | 'outlined' | 'text' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

const VARIANT_CLASSES: Record<Variant, string> = {
  filled: 'bg-primary text-white shadow-sm hover:bg-primary-hover disabled:opacity-50',
  outlined: 'border border-border-dark text-gray-100 hover:bg-surface-dark-2 disabled:opacity-50',
  text: 'text-primary hover:underline disabled:opacity-50 disabled:no-underline',
  danger: 'text-red-400 hover:underline disabled:opacity-50 disabled:no-underline',
}

// Material的な3種類(+削除用danger)のボタンに統一する。filled=主要操作、outlined=副次操作、
// text/danger=リンク的な軽い操作 (一覧の「編集」「削除」等)。
export default function Button({ variant = 'outlined', className = '', type = 'button', ...props }: ButtonProps) {
  const base = variant === 'text' || variant === 'danger'
    ? 'text-sm font-medium transition-colors'
    : 'rounded px-3 py-1.5 text-sm font-medium transition-colors'
  return (
    <button
      type={type}
      className={`${base} ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  )
}
