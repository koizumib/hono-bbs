/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6',
        'primary-hover': '#2563eb',
        'background-dark': '#0f1115',
        'surface-dark': '#161920',
        'surface-dark-2': '#1a1d24',
        'border-dark': '#1e293b',
      },
      borderRadius: {
        DEFAULT: '0.1875rem', // 3px — 既定の角丸をわずかに抑える
        md: '0.25rem',        // 4px
        lg: '0.375rem',       // 6px — カード等の大きめコンテナ用 (Tailwind既定の0.5remより抑える)
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
}
