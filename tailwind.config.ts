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
        crm: {
          canvas: "var(--crm-canvas)",
          surface: "var(--crm-surface)",
          primary: "var(--crm-primary)",
          muted: "var(--crm-muted)",
          disabled: "var(--crm-disabled)",
          alert: "var(--crm-alert)",
          link: "var(--crm-link)",
          border: "var(--crm-border)",
          focus: "var(--crm-focus)",
        },
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
        "crm-ui": ["var(--font-crm-inter)", "system-ui", "sans-serif"],
        "crm-data": ["var(--font-crm-inter)", "system-ui", "sans-serif"],
        "crm-code": ["var(--font-crm-mono)", "Consolas", "ui-monospace", "monospace"],
      },
      fontSize: {
        "crm-micro": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.02em" }],
        "crm-meta": ["0.75rem", { lineHeight: "1.125rem", letterSpacing: "0.01em" }],
        "crm-label": ["0.8125rem", { lineHeight: "1.25rem", letterSpacing: "0.01em" }],
        "crm-table": ["0.875rem", { lineHeight: "1.375rem", letterSpacing: "0em" }],
        "crm-body": ["0.9375rem", { lineHeight: "1.5rem", letterSpacing: "0em" }],
        "crm-section": ["1.125rem", { lineHeight: "1.625rem", letterSpacing: "-0.01em" }],
        "crm-balance": ["1.5rem", { lineHeight: "2rem", letterSpacing: "-0.015em" }],
        "crm-title": ["1.875rem", { lineHeight: "2.375rem", letterSpacing: "-0.025em" }],
        "crm-title-lg": ["2.25rem", { lineHeight: "2.75rem", letterSpacing: "-0.03em" }],
      },
    },
  },
  plugins: [],
};

export default config;
