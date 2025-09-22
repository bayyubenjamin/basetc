import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
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
        // Gradients from reference
        'brand-logo-from': '#0f1924',
        'brand-logo-to': '#071017',
        'pill-from': '#0f1622',
        'pill-to': ' #0a1119',
        'btn-from': '#111827',
        'btn-to': '#0e1620',
        'btn-primary-from': '#0f2432',
        'btn-primary-to': '#0b1722',
        'monitor-from': '#0f1622',
        'monitor-to': '#0c1119',
        'screen-bg': '#041018',
        'tile-from': '#07121a',
        'tile-to': '#061018',
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
