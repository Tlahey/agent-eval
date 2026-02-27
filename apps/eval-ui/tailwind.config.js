/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "var(--color-primary)",
        "primary-hover": "var(--color-primary-hover)",
        surface: "var(--color-surface)",
        "surface-alt": "var(--color-surface-alt)",
        border: "var(--color-border)",
        "text-base": "var(--color-text-base)",
        "text-muted": "var(--color-text-muted)",
        "text-inverse": "var(--color-text-inverse)",
        success: "var(--color-success)",
        danger: "var(--color-danger)",
        warning: "var(--color-warning)",
      },
    },
  },
  plugins: [],
};
