import type { HTMLAttributes } from 'react'

// 罫線だけでなく影で階層感を出すコンテナ (Materialのelevated surfaceに近い扱い)。
export default function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-lg border border-border-dark/50 bg-surface-dark shadow-sm ${className}`}
      {...props}
    />
  )
}
