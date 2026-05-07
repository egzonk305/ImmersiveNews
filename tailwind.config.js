/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'var(--font-inter)',
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Text',
          'Segoe UI',
          'system-ui',
          'sans-serif',
        ],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      colors: {
        brand: {
          50:  '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
        },
        ink: {
          50:  '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
      },
      boxShadow: {
        'glass-sm': '0 1px 2px rgba(15,23,42,0.04), 0 1px 6px rgba(99,102,241,0.04)',
        'glass':    '0 2px 8px rgba(15,23,42,0.05), 0 4px 24px -4px rgba(99,102,241,0.08)',
        'glass-lg': '0 4px 14px rgba(15,23,42,0.06), 0 12px 44px -8px rgba(99,102,241,0.14)',
        'glow':     '0 0 0 4px rgba(139,92,246,0.12)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      keyframes: {
        'fade-in':       { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        'fade-in-up':    { '0%': { opacity: 0, transform: 'translateY(6px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        'scale-in':      { '0%': { opacity: 0, transform: 'scale(0.96)' }, '100%': { opacity: 1, transform: 'scale(1)' } },
        'shimmer':       { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        'pulse-soft':    { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.55 } },
      },
      animation: {
        'fade-in':       'fade-in 0.25s ease-out',
        'fade-in-up':    'fade-in-up 0.30s ease-out',
        'scale-in':      'scale-in 0.20s ease-out',
        'shimmer':       'shimmer 2.4s linear infinite',
        'pulse-soft':    'pulse-soft 2s ease-in-out infinite',
      },
      transitionTimingFunction: {
        'apple': 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
    },
  },
  plugins: [],
}
