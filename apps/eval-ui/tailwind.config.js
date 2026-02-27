/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "var(--color-primary)",
          hover: "var(--color-primary-hover)",
          dim: "var(--color-primary-dim)",
        },
        accent: "var(--color-accent)",
        surface: {
          0: "var(--color-surface-0)",
          1: "var(--color-surface-1)",
          2: "var(--color-surface-2)",
          3: "var(--color-surface-3)",
          4: "var(--color-surface-4)",
        },
        border: {
          DEFAULT: "var(--color-border)",
          hover: "var(--color-border-hover)",
        },
        txt: {
          base: "var(--color-text-base)",
          secondary: "var(--color-text-secondary)",
          muted: "var(--color-text-muted)",
          inverse: "var(--color-text-inverse)",
        },
        ok: { DEFAULT: "var(--color-success)", dim: "var(--color-success-dim)" },
        err: { DEFAULT: "var(--color-danger)", dim: "var(--color-danger-dim)" },
        warn: { DEFAULT: "var(--color-warning)", dim: "var(--color-warning-dim)" },
        info: { DEFAULT: "var(--color-info)", dim: "var(--color-info-dim)" },
      },
      fontFamily: {
        mono: ["SF Mono", "Fira Code", "Cascadia Code", "monospace"],
      },
    },
  },
  plugins: [],
};
