/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "hsl(var(--color-primary) / <alpha-value>)",
        accent: "hsl(var(--color-accent) / <alpha-value>)",
        surface: {
          0: "hsl(var(--color-surface-0) / <alpha-value>)",
          1: "hsl(var(--color-surface-1) / <alpha-value>)",
          2: "hsl(var(--color-surface-2) / <alpha-value>)",
          3: "hsl(var(--color-surface-3) / <alpha-value>)",
          4: "hsl(var(--color-surface-4) / <alpha-value>)",
        },
        border: {
          DEFAULT: "#1e293b", // slate-800
          hover: "#334155", // slate-700
        },
        txt: {
          base: "hsl(var(--color-txt-base) / <alpha-value>)",
          secondary: "hsl(var(--color-txt-secondary) / <alpha-value>)",
          muted: "hsl(var(--color-txt-muted) / <alpha-value>)",
        },
        ok: "hsl(var(--color-ok) / <alpha-value>)",
        err: "hsl(var(--color-err) / <alpha-value>)",
        warn: "hsl(var(--color-warn) / <alpha-value>)",
        info: "hsl(var(--color-info) / <alpha-value>)",
      },
      borderColor: {
        DEFAULT: "#1e293b",
      },
      fontFamily: {
        mono: ["SF Mono", "Fira Code", "Cascadia Code", "monospace"],
      },
    },
  },
  plugins: [],
};
