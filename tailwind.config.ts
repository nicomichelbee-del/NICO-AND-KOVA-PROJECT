import type { Config } from 'tailwindcss'

export default {
  content: ['./client/index.html', './client/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#131017',
          surface: '#181420',
          card: '#1f1b28',
          raised: '#292333',
        },
        gold: {
          DEFAULT: '#f0b65a',
          dim: '#e0982e',
          deep: '#c47a16',
          pale: 'rgba(240,182,90,0.14)',
        },
        ink: {
          0: '#f5f1e8',
          1: '#d8d2c2',
          2: '#9a9385',
          3: '#6a6557',
        },
        pitch: {
          DEFAULT: '#2f7d4f',
          light: '#4ea36e',
        },
        crimson: {
          DEFAULT: '#c94545',
          light: '#e35a5a',
        },
        border: 'rgba(245,241,232,0.08)',
        muted: '#9a9385',
      },
      fontFamily: {
        serif: ['Fraunces', '"Source Serif Pro"', 'Georgia', 'serif'],
        sans: ['Geist', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', 'JetBrains Mono', 'ui-monospace', 'monospace'],
        display: ['Fraunces', '"Source Serif Pro"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
