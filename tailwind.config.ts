import type { Config } from 'tailwindcss'

export default {
  content: ['./client/index.html', './client/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#07090f',
          surface: '#0c1118',
          card: '#0f1729',
        },
        gold: {
          DEFAULT: '#eab308',
          dim: '#ca8a04',
          pale: 'rgba(234,179,8,0.1)',
        },
        border: 'rgba(255,255,255,0.07)',
        muted: '#64748b',
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
