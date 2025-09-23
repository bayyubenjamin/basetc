import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      /* spacing tambahan */
      spacing: {
        "2.5": "0.625rem", // 10px
      },

      /* warna kustom — dipakai via:
         text-text, text-muted, bg-bg, bg-panel, border-edge, dll */
      colors: {
        bg: "#0b0e12",
        panel: "#0e141c",
        edge: "#202838",
        text: "#e9eef7",
        muted: "#9aacc6",
        accent: "#5ad6ff",
        accent2: "#a993ff",
        ok: "#75e0a7",
        warn: "#ffd37a",
        danger: "#ff8e8e",
      },

      /* radius & shadow sesuai desain */
      borderRadius: {
        card: "14px",
      },
      boxShadow: {
        main:
          "0 12px 32px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.02)",
      },
    },
  },
  plugins: [],
};

export default config;

