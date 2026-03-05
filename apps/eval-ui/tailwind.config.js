/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "hsl(var(--c-primary) / <alpha-value>)",
        accent: "hsl(var(--c-accent) / <alpha-value>)",
        surface: {
          0: "hsl(var(--c-surface-0) / <alpha-value>)",
          1: "hsl(var(--c-surface-1) / <alpha-value>)",
          2: "hsl(var(--c-surface-2) / <alpha-value>)",
          3: "hsl(var(--c-surface-3) / <alpha-value>)",
          4: "hsl(var(--c-surface-4) / <alpha-value>)",
        },
        txt: {
          base: "hsl(var(--c-txt-base) / <alpha-value>)",
          secondary: "hsl(var(--c-txt-secondary) / <alpha-value>)",
          muted: "hsl(var(--c-txt-muted) / <alpha-value>)",
        },
        ok: "hsl(var(--c-ok) / <alpha-value>)",
        err: "hsl(var(--c-err) / <alpha-value>)",
        warn: "hsl(var(--c-warn) / <alpha-value>)",
        info: "hsl(var(--c-info) / <alpha-value>)",
      },
      borderColor: {
        DEFAULT: "hsl(var(--c-line) / 0.15)",
        divider: "hsl(var(--c-line) / <alpha-value>)",
      },
      fontFamily: {
        mono: ["SF Mono", "Fira Code", "Cascadia Code", "monospace"],
      },
    },
  },
  plugins: [],
};
