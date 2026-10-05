import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        muted: "var(--color-muted)",
        surface: "var(--color-surface)",
        line: "var(--color-line)",
        "zayan-blue": {
          DEFAULT: "var(--color-zayan-blue)",
          dark: "var(--color-zayan-blue-dark)",
        },
        "zayan-orange": {
          DEFAULT: "var(--color-zayan-orange)",
          dark: "var(--color-zayan-orange-dark)",
        },
      },
      fontFamily: {
        sans: ["var(--font-jakarta)", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
