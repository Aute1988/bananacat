/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // 🍌🐱 香蕉猫主题色 - Glassmorphism 设计系统 v3
      colors: {
        banana: {
          50:  '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          DEFAULT: '#fcd34d',
        },
        cat: {
          50:  '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#b794f6',
          500: '#a855f7',
          600: '#9061f9',
          700: '#7e22ce',
          800: '#6b21a8',
          900: '#581c87',
          DEFAULT: '#b794f6',
        },
        primary: {
          DEFAULT: '#fcd34d',
          fg: '#0a0a14',
        },
      },
      fontFamily: {
        display: ['"Sora"', '"Space Grotesk"', 'Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        orbitron: ['"Orbitron"', 'monospace'],
      },
      fontSize: {
        'display-xl': ['5rem',  { lineHeight: '0.95', letterSpacing: '-0.045em', fontWeight: '900' }],
        'display-lg': ['4rem',  { lineHeight: '1',    letterSpacing: '-0.04em',  fontWeight: '800' }],
        'display-md': ['2.75rem',{ lineHeight: '1.05', letterSpacing: '-0.03em',  fontWeight: '800' }],
      },
      backgroundImage: {
        'banana-gradient':   'linear-gradient(135deg, #ffe066 0%, #fbbf24 50%, #f59e0b 100%)',
        'banana-hot':        'linear-gradient(135deg, #fef3c7 0%, #fcd34d 35%, #f59e0b 70%, #ea580c 100%)',
        'cat-gradient':      'linear-gradient(135deg, #d8b4fe 0%, #9061f9 100%)',
        'cosmic-gradient':   'linear-gradient(135deg, #fcd34d 0%, #f472b6 45%, #b794f6 100%)',
        'aurora-gradient':   'linear-gradient(135deg, #67e8f9 0%, #b794f6 50%, #f472b6 100%)',
        'platinum-gradient': 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 50%, #94a3b8 100%)',
        'gold-gradient':     'linear-gradient(135deg, #fef9c3 0%, #fcd34d 50%, #b45309 100%)',
        'mesh-aurora':       'radial-gradient(at 15% 15%, rgba(252, 211, 77, 0.28) 0px, transparent 50%), radial-gradient(at 85% 5%, rgba(244, 114, 182, 0.22) 0px, transparent 50%), radial-gradient(at 5% 85%, rgba(139, 92, 246, 0.30) 0px, transparent 50%), radial-gradient(at 85% 85%, rgba(103, 232, 249, 0.20) 0px, transparent 50%), radial-gradient(at 50% 50%, rgba(232, 121, 249, 0.12) 0px, transparent 60%)',
        'grid-pattern':      "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
        'dot-pattern':       "radial-gradient(circle, rgba(255,255,255,0.10) 1px, transparent 1px)",
      },
      backgroundSize: {
        'grid-md': '48px 48px',
        'grid-lg': '64px 64px',
        'dot-sm':  '20px 20px',
        'dot-md':  '32px 32px',
      },
      backdropBlur: {
        xs: '2px',
        '3xl': '72px',
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        'glow-banana': '0 0 60px rgba(252, 211, 77, 0.40), 0 0 120px rgba(252, 211, 77, 0.15)',
        'glow-banana-sm': '0 0 24px rgba(252, 211, 77, 0.45)',
        'glow-cat':    '0 0 60px rgba(183, 148, 246, 0.45), 0 0 120px rgba(183, 148, 246, 0.15)',
        'glow-pink':   '0 0 60px rgba(244, 114, 182, 0.40)',
        'glow-cyan':   '0 0 60px rgba(103, 232, 249, 0.40)',
        'glow-cosmic': '0 0 60px rgba(236, 72, 153, 0.4), 0 0 80px rgba(192, 132, 252, 0.2)',
        'glass':       '0 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
        'glass-hover': '0 24px 64px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(252, 211, 77, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
        'glass-elevated': '0 32px 80px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.10)',
        'btn-banana':  '0 8px 24px rgba(252, 211, 77, 0.40), inset 0 1px 0 rgba(255, 255, 255, 0.50), inset 0 -1px 0 rgba(0, 0, 0, 0.15)',
        'btn-cat':     '0 8px 24px rgba(183, 148, 246, 0.40), inset 0 1px 0 rgba(255, 255, 255, 0.30), inset 0 -1px 0 rgba(0, 0, 0, 0.15)',
      },
      animation: {
        'pulse-glow':     'pulse-glow 2.5s ease-in-out infinite',
        'float':          'float 3s ease-in-out infinite',
        'float-slow':     'float-slow 8s ease-in-out infinite',
        'float-reverse':  'float-reverse 4s ease-in-out infinite',
        'fade-in':        'fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-up':       'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
        'aurora':         'aurora 15s ease-in-out infinite',
        'spin-slow':      'spin 12s linear infinite',
        'shimmer':        'shimmer 2s linear infinite',
        'gradient-shift': 'gradient-shift 8s ease-in-out infinite',
        'orbit':          'orbit 20s linear infinite',
        'orbit-reverse':  'orbit-reverse 30s linear infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(252, 211, 77, 0.6), 0 0 24px rgba(252, 211, 77, 0.4)' },
          '50%':      { boxShadow: '0 0 0 16px rgba(252, 211, 77, 0), 0 0 48px rgba(252, 211, 77, 0.6)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-12px)' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '50%':      { transform: 'translateY(-20px) rotate(2deg)' },
        },
        'float-reverse': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(14px)' },
        },
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        aurora: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)',     opacity: '0.55' },
          '33%':      { transform: 'translate(40px, -60px) scale(1.15)', opacity: '0.85' },
          '66%':      { transform: 'translate(-30px, 40px) scale(0.9)',  opacity: '0.65' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%':      { backgroundPosition: '100% 50%' },
        },
        orbit: {
          from: { transform: 'rotate(0deg) translateX(var(--orbit-r, 120px)) rotate(0deg)' },
          to:   { transform: 'rotate(360deg) translateX(var(--orbit-r, 120px)) rotate(-360deg)' },
        },
        'orbit-reverse': {
          from: { transform: 'rotate(0deg) translateX(var(--orbit-r, 120px)) rotate(0deg)' },
          to:   { transform: 'rotate(-360deg) translateX(var(--orbit-r, 120px)) rotate(360deg)' },
        },
      },
      transitionTimingFunction: {
        'out-expo':  'cubic-bezier(0.16, 1, 0.3, 1)',
        'out-quart': 'cubic-bezier(0.25, 1, 0.5, 1)',
        'spring':    'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [],
}
