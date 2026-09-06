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
        'c-border': 'var(--c-border)',
        'c-accent': 'var(--c-accent)',
        // リンク
        'c-link-image': 'var(--c-link-image)',
        'c-link-image-hover': 'var(--c-link-image-hover)',
        'c-link-twitter': 'var(--c-link-twitter)',
        'c-link-twitter-hover': 'var(--c-link-twitter-hover)',
        'c-link-youtube': 'var(--c-link-youtube)',
        'c-link-youtube-hover': 'var(--c-link-youtube-hover)',
        'c-link-url': 'var(--c-link-url)',
        'c-link-url-hover': 'var(--c-link-url-hover)',
        // アンカー
        'c-anchor': 'var(--c-anchor)',
        'c-anchor-hover': 'var(--c-anchor-hover)',
        // 投稿者名
        'c-poster-name': 'var(--c-poster-name)',
        'c-poster-name-hover': 'var(--c-poster-name-hover)',
        // ID 色
        'c-id-default': 'var(--c-id-default)',
        'c-id-first': 'var(--c-id-first)',
        'c-id-warm': 'var(--c-id-warm)',
        'c-id-hot': 'var(--c-id-hot)',
        'c-id-very-hot': 'var(--c-id-very-hot)',
        // 人気レス色
        'c-heat-warm': 'var(--c-heat-warm)',
        'c-heat-hot': 'var(--c-heat-hot)',
        'c-heat-very-hot': 'var(--c-heat-very-hot)',
      },
      fontFamily: {
        display: ['"Noto Sans JP"', 'sans-serif'],
        sans: ['"Noto Sans JP"', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
        full: '9999px',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
}
