import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      boxShadow: {
        neu: '8px 8px 16px rgba(0,0,0,0.6), -8px -8px 16px rgba(255,255,255,0.05)',
        'neu-inner': 'inset 6px 6px 10px rgba(0,0,0,0.6), inset -6px -6px 10px rgba(255,255,255,0.05)',
        'neu-sm': '4px 4px 8px rgba(0,0,0,0.6), -4px -4px 8px rgba(255,255,255,0.05)',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        marquee: 'marquee 22s linear infinite',
      },
      borderRadius: {
        xl: '14px',
        '2xl': '18px',
      },
    },
  },
  plugins: [],
} satisfies Config;

