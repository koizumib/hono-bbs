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
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
}
