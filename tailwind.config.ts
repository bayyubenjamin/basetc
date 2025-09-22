import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // FIX: Menambahkan nilai spasi yang dibutuhkan dari referensi Anda
      spacing: {
        '2.5': '0.625rem', // 10px
      },
      colors: {
        'bg': '#0b0e12',
        'panel': '#0e141c',
        'edge': '#202838',
        'text-primary': '#e9eef7',
        'text-muted': '#9aacc6',
        'accent': '#5ad6ff',
        'accent2': '#a993ff',
        'ok': '#75e0a7',
        'warn': '#ffd37a',
        'danger': '#ff8e8e',
      },
      borderRadius: {
        'card': '14px',
      },
      boxShadow: {
        'main': '0 12px 32px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.02)',
      }
    },
  },
  plugins: [],
};
export default config;
