/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#00D9FF',
        background: '#0A0A0A',
        surface: '#1A1A1A',
        'surface-light': '#2A2A2A',
        'text-primary': '#FFFFFF',
        'text-secondary': '#A0A0A0',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backdropBlur: {
        glass: '12px',
      },
    },
  },
  plugins: [],
}
