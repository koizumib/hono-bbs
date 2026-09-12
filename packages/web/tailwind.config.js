/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6',
        'background-dark': '#0f1115',
        'surface-dark': '#161920',
        'surface-dark-2': '#1a1d24',
        'border-dark': '#1e293b',
        'c-base': 'var(--c-base)',
        'c-surface': 'var(--c-surface)',
        'c-surface2': 'var(--c-surface2)',
        'c-surface3': 'var(--c-surface3)',
        'c-border': 'var(--c-border)',
        'c-border-strong': 'var(--c-border-strong)',
        'c-text-strong': 'var(--c-text-strong)',
        'c-text-body': 'var(--c-text-body)',
        'c-text-muted': 'var(--c-text-muted)',
        'c-text-emphasis': 'var(--c-text-emphasis)',
        'c-accent': 'var(--c-accent)',
        'c-accent-hover': 'var(--c-accent-hover)',
        // 「自分」用の差し色(未読・自分の投稿・自分へのアンカー)。操作色(c-accent)とは別系統
        'c-accent-self': 'var(--c-accent-self)',
        'c-accent-self-wash': 'var(--c-accent-self-wash)',
        // リンク
        'c-link': 'var(--c-link)',
        'c-link-image': 'var(--c-link-image)',
        'c-link-twitter': 'var(--c-link-twitter)',
        'c-link-youtube': 'var(--c-link-youtube)',
        // 投稿者名
        'c-poster-name': 'var(--c-poster-name)',
        // ID色・人気レス色（共通の暖色ランプ）
        'c-heat-warm': 'var(--c-heat-warm)',
        'c-heat-hot': 'var(--c-heat-hot)',
        'c-heat-very-hot': 'var(--c-heat-very-hot)',
      },
      fontFamily: {
        display: ['"Noto Sans JP"', 'sans-serif'],
        sans: ['"Noto Sans JP"', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.1875rem',
        lg: '0.375rem',
        xl: '0.5rem',
        '2xl': '0.625rem',
        full: '9999px',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
}
