/**
 * Seed script – populates .agenteval/ledger.sqlite with realistic test data.
 *
 * Usage:  pnpm seed          (or)  npx tsx scripts/seed-ledger.ts
 * Requires: Node 22+ (node:sqlite)
 */

import { mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
// @ts-expect-error -- node:sqlite has no stable types yet
import { DatabaseSync } from "node:sqlite";

// ── paths ────────────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUTPUT_DIR = join(ROOT, ".agenteval");
const DB_PATH = join(OUTPUT_DIR, "ledger.sqlite");

// ── schema (mirrors packages/agent-eval/src/ledger/ledger.ts) ────────────────
function initDb(): InstanceType<typeof DatabaseSync> {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  // Remove old seed DB so we start fresh
  try {
    rmSync(DB_PATH);
  } catch {
    /* does not exist yet */
  }
  const db = new DatabaseSync(DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      test_id      TEXT    NOT NULL,
      suite_path   TEXT    NOT NULL DEFAULT '[]',
      timestamp    TEXT    NOT NULL,
      agent_runner TEXT    NOT NULL,
      judge_model  TEXT    NOT NULL,
      score        REAL    NOT NULL,
      pass         INTEGER NOT NULL,
      reason       TEXT    NOT NULL,
      improvement  TEXT    NOT NULL DEFAULT '',
      diff         TEXT,
      commands     TEXT,
      duration_ms  INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_runs_test_id  ON runs(test_id);
    CREATE INDEX IF NOT EXISTS idx_runs_timestamp ON runs(timestamp);

    CREATE TABLE IF NOT EXISTS score_overrides (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id    INTEGER NOT NULL REFERENCES runs(id),
      score     REAL    NOT NULL,
      pass      INTEGER NOT NULL,
      reason    TEXT    NOT NULL,
      timestamp TEXT    NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_overrides_run_id ON score_overrides(run_id);
  `);
  return db;
}

// ── helpers ──────────────────────────────────────────────────────────────────
function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}
function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── test definitions ─────────────────────────────────────────────────────────
const TEST_IDS = [
  "add close button to Banner",
  "implement search with debounce",
  "add loading spinner",
  "create dark mode toggle",
  "refactor API service layer",
] as const;

/** Suite hierarchy for each test (simulates describe() nesting) */
const SUITE_PATHS: Record<string, string[]> = {
  "add close button to Banner": ["UI Components", "Banner"],
  "implement search with debounce": ["UI Components", "Search"],
  "add loading spinner": ["UI Components"],
  "create dark mode toggle": ["Theme"],
  "refactor API service layer": [], // top-level test, no suite
};

const RUNNERS: Record<string, { min: number; max: number }> = {
  copilot: { min: 0.7, max: 0.95 },
  cursor: { min: 0.6, max: 0.9 },
  "claude-code": { min: 0.75, max: 0.98 },
  aider: { min: 0.5, max: 0.85 },
};

const JUDGE_MODELS = ["gpt-4o", "claude-sonnet-4-20250514", "gpt-4o-mini"] as const;

// ── realistic diffs ──────────────────────────────────────────────────────────
const DIFF_TEMPLATES: Record<string, string[]> = {
  "add close button to Banner": [
    `diff --git a/src/components/Banner.tsx b/src/components/Banner.tsx
index 3a1f2c4..9b8e7d1 100644
--- a/src/components/Banner.tsx
+++ b/src/components/Banner.tsx
@@ -1,5 +1,6 @@
 import React, { useState } from "react";
+import { XMarkIcon } from "@heroicons/react/24/solid";
 import styles from "./Banner.module.css";

 interface BannerProps {
@@ -8,14 +9,26 @@ interface BannerProps {
   variant?: "info" | "warning" | "error";
+  dismissible?: boolean;
+  onClose?: () => void;
 }

-export function Banner({ message, variant = "info" }: BannerProps) {
+export function Banner({ message, variant = "info", dismissible = false, onClose }: BannerProps) {
+  const [visible, setVisible] = useState(true);
+
+  const handleClose = () => {
+    setVisible(false);
+    onClose?.();
+  };
+
+  if (!visible) return null;
+
   return (
-    <div className={\`\${styles.banner} \${styles[variant]}\`}>
-      <p>{message}</p>
+    <div className={\`\${styles.banner} \${styles[variant]}\`} role="alert">
+      <p className={styles.message}>{message}</p>
+      {dismissible && (
+        <button className={styles.closeBtn} onClick={handleClose} aria-label="Close banner">
+          <XMarkIcon className={styles.icon} />
+        </button>
+      )}
     </div>
   );
 }`,
    `diff --git a/src/components/Banner.tsx b/src/components/Banner.tsx
index 3a1f2c4..d4c8b12 100644
--- a/src/components/Banner.tsx
+++ b/src/components/Banner.tsx
@@ -1,4 +1,5 @@
 import React from "react";
+import { IoClose } from "react-icons/io5";
 import "./Banner.css";

 export const Banner = ({ text, type = "info" }) => {
@@ -7,6 +8,15 @@ export const Banner = ({ text, type = "info" }) => {
   return (
     <div className={\`banner banner--\${type}\`}>
       <span>{text}</span>
+      <button
+        className="banner__close"
+        onClick={() => setOpen(false)}
+        type="button"
+        aria-label="Dismiss"
+      >
+        <IoClose size={18} />
+      </button>
     </div>
   );
 };`,
  ],

  "implement search with debounce": [
    `diff --git a/src/hooks/useSearch.ts b/src/hooks/useSearch.ts
new file mode 100644
index 0000000..a7c3e29
--- /dev/null
+++ b/src/hooks/useSearch.ts
@@ -0,0 +1,38 @@
+import { useState, useEffect, useRef } from "react";
+
+interface UseSearchOptions {
+  debounceMs?: number;
+  minLength?: number;
+}
+
+export function useSearch<T>(
+  searchFn: (query: string) => Promise<T[]>,
+  opts: UseSearchOptions = {},
+) {
+  const { debounceMs = 300, minLength = 2 } = opts;
+  const [query, setQuery] = useState("");
+  const [results, setResults] = useState<T[]>([]);
+  const [loading, setLoading] = useState(false);
+  const timerRef = useRef<ReturnType<typeof setTimeout>>();
+
+  useEffect(() => {
+    if (timerRef.current) clearTimeout(timerRef.current);
+
+    if (query.length < minLength) {
+      setResults([]);
+      return;
+    }
+
+    timerRef.current = setTimeout(async () => {
+      setLoading(true);
+      try {
+        const data = await searchFn(query);
+        setResults(data);
+      } finally {
+        setLoading(false);
+      }
+    }, debounceMs);
+
+    return () => clearTimeout(timerRef.current);
+  }, [query, debounceMs, minLength, searchFn]);
+
+  return { query, setQuery, results, loading };
+}`,
    `diff --git a/src/components/SearchBar.tsx b/src/components/SearchBar.tsx
index 8b13789..f4a2e1c 100644
--- a/src/components/SearchBar.tsx
+++ b/src/components/SearchBar.tsx
@@ -1,12 +1,34 @@
-import React from "react";
+import React, { useCallback } from "react";
+import { useSearch } from "../hooks/useSearch";
+import { searchAPI } from "../services/api";
+import { Spinner } from "./Spinner";

-export function SearchBar() {
+export function SearchBar({ onResults }: { onResults: (items: Item[]) => void }) {
+  const { query, setQuery, results, loading } = useSearch(
+    useCallback((q: string) => searchAPI.query(q), []),
+    { debounceMs: 350, minLength: 2 },
+  );
+
+  useEffect(() => {
+    onResults(results);
+  }, [results, onResults]);
+
   return (
-    <input type="text" placeholder="Search..." />
+    <div className="search-bar">
+      <input
+        type="search"
+        value={query}
+        onChange={(e) => setQuery(e.target.value)}
+        placeholder="Search items..."
+        aria-label="Search"
+      />
+      {loading && <Spinner size="sm" />}
+    </div>
   );
 }`,
  ],

  "add loading spinner": [
    `diff --git a/src/components/Spinner.tsx b/src/components/Spinner.tsx
new file mode 100644
index 0000000..c2d8f9a
--- /dev/null
+++ b/src/components/Spinner.tsx
@@ -0,0 +1,24 @@
+import React from "react";
+import styles from "./Spinner.module.css";
+
+interface SpinnerProps {
+  size?: "sm" | "md" | "lg";
+  label?: string;
+}
+
+export function Spinner({ size = "md", label = "Loading…" }: SpinnerProps) {
+  return (
+    <div className={styles.wrapper} role="status" aria-label={label}>
+      <svg
+        className={\`\${styles.spinner} \${styles[size]}\`}
+        viewBox="0 0 24 24"
+        fill="none"
+      >
+        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
+        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
+      </svg>
+      <span className="sr-only">{label}</span>
+    </div>
+  );
+}
diff --git a/src/components/Spinner.module.css b/src/components/Spinner.module.css
new file mode 100644
index 0000000..1e3ab0f
--- /dev/null
+++ b/src/components/Spinner.module.css
@@ -0,0 +1,15 @@
+.wrapper { display: inline-flex; align-items: center; justify-content: center; }
+.spinner { animation: spin 0.75s linear infinite; }
+.sm  { width: 16px; height: 16px; }
+.md  { width: 24px; height: 24px; }
+.lg  { width: 40px; height: 40px; }
+@keyframes spin { to { transform: rotate(360deg); } }`,
    `diff --git a/src/components/DataTable.tsx b/src/components/DataTable.tsx
index 6e1c4a2..b9f8d31 100644
--- a/src/components/DataTable.tsx
+++ b/src/components/DataTable.tsx
@@ -1,5 +1,6 @@
 import React from "react";
 import { useQuery } from "@tanstack/react-query";
+import { Spinner } from "./Spinner";

 export function DataTable() {
   const { data, isLoading, error } = useQuery({ queryKey: ["items"], queryFn: fetchItems });
@@ -8,7 +9,7 @@ export function DataTable() {
   if (error) return <p className="error">Failed to load data.</p>;

-  if (isLoading) return <p>Loading...</p>;
+  if (isLoading) return <Spinner label="Loading table data…" />;

   return (
     <table>`,
  ],

  "create dark mode toggle": [
    `diff --git a/src/hooks/useDarkMode.ts b/src/hooks/useDarkMode.ts
new file mode 100644
index 0000000..e9b3c5a
--- /dev/null
+++ b/src/hooks/useDarkMode.ts
@@ -0,0 +1,29 @@
+import { useEffect, useState } from "react";
+
+type Theme = "light" | "dark";
+
+const STORAGE_KEY = "theme-preference";
+
+function getSystemTheme(): Theme {
+  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
+}
+
+export function useDarkMode() {
+  const [theme, setTheme] = useState<Theme>(() => {
+    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
+    return saved ?? getSystemTheme();
+  });
+
+  useEffect(() => {
+    document.documentElement.setAttribute("data-theme", theme);
+    localStorage.setItem(STORAGE_KEY, theme);
+  }, [theme]);
+
+  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
+
+  return { theme, toggle, setTheme };
+}
diff --git a/src/components/ThemeToggle.tsx b/src/components/ThemeToggle.tsx
new file mode 100644
index 0000000..3fb8901
--- /dev/null
+++ b/src/components/ThemeToggle.tsx
@@ -0,0 +1,18 @@
+import React from "react";
+import { useDarkMode } from "../hooks/useDarkMode";
+import { SunIcon, MoonIcon } from "@heroicons/react/24/outline";
+
+export function ThemeToggle() {
+  const { theme, toggle } = useDarkMode();
+
+  return (
+    <button
+      onClick={toggle}
+      aria-label={\`Switch to \${theme === "dark" ? "light" : "dark"} mode\`}
+      className="theme-toggle"
+    >
+      {theme === "dark" ? <SunIcon width={20} /> : <MoonIcon width={20} />}
+    </button>
+  );
+}`,
    `diff --git a/src/context/ThemeContext.tsx b/src/context/ThemeContext.tsx
new file mode 100644
index 0000000..ab12cd3
--- /dev/null
+++ b/src/context/ThemeContext.tsx
@@ -0,0 +1,35 @@
+import React, { createContext, useContext, useState, useEffect } from "react";
+
+type Theme = "light" | "dark" | "system";
+
+const ThemeCtx = createContext<{ theme: Theme; setTheme: (t: Theme) => void } | null>(null);
+
+export function ThemeProvider({ children }: { children: React.ReactNode }) {
+  const [theme, setTheme] = useState<Theme>(
+    () => (localStorage.getItem("ui-theme") as Theme) ?? "system",
+  );
+
+  useEffect(() => {
+    const resolved =
+      theme === "system"
+        ? window.matchMedia("(prefers-color-scheme: dark)").matches
+          ? "dark"
+          : "light"
+        : theme;
+    document.documentElement.classList.toggle("dark", resolved === "dark");
+    localStorage.setItem("ui-theme", theme);
+  }, [theme]);
+
+  return <ThemeCtx.Provider value={{ theme, setTheme }}>{children}</ThemeCtx.Provider>;
+}
+
+export function useTheme() {
+  const ctx = useContext(ThemeCtx);
+  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
+  return ctx;
+}`,
  ],

  "refactor API service layer": [
    `diff --git a/src/services/api.ts b/src/services/api.ts
index 9f8e2a1..c4d1b73 100644
--- a/src/services/api.ts
+++ b/src/services/api.ts
@@ -1,42 +1,58 @@
-export async function getUsers() {
-  const res = await fetch("/api/users");
-  return res.json();
-}
-
-export async function getUser(id: string) {
-  const res = await fetch(\`/api/users/\${id}\`);
-  return res.json();
-}
-
-export async function createUser(data: any) {
-  const res = await fetch("/api/users", {
-    method: "POST",
-    headers: { "Content-Type": "application/json" },
-    body: JSON.stringify(data),
-  });
-  return res.json();
-}
+import { z } from "zod";
+
+class ApiClient {
+  private baseUrl: string;
+
+  constructor(baseUrl = "/api") {
+    this.baseUrl = baseUrl;
+  }
+
+  private async request<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
+    const res = await fetch(\`\${this.baseUrl}\${path}\`, {
+      ...init,
+      headers: { "Content-Type": "application/json", ...init?.headers },
+    });
+
+    if (!res.ok) {
+      throw new ApiError(res.status, await res.text());
+    }
+
+    const json = await res.json();
+    return schema.parse(json);
+  }
+
+  get<T>(path: string, schema: z.ZodType<T>) {
+    return this.request(path, schema);
+  }
+
+  post<T>(path: string, body: unknown, schema: z.ZodType<T>) {
+    return this.request(path, schema, { method: "POST", body: JSON.stringify(body) });
+  }
+}
+
+export class ApiError extends Error {
+  constructor(public status: number, public body: string) {
+    super(\`API error \${status}: \${body}\`);
+    this.name = "ApiError";
+  }
+}
+
+export const api = new ApiClient();`,
    `diff --git a/src/services/httpClient.ts b/src/services/httpClient.ts
new file mode 100644
index 0000000..7d1ae2f
--- /dev/null
+++ b/src/services/httpClient.ts
@@ -0,0 +1,44 @@
+interface RequestConfig {
+  baseURL: string;
+  timeout?: number;
+  headers?: Record<string, string>;
+}
+
+export function createHttpClient(config: RequestConfig) {
+  const { baseURL, timeout = 10_000, headers = {} } = config;
+
+  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
+    const controller = new AbortController();
+    const id = setTimeout(() => controller.abort(), timeout);
+
+    try {
+      const res = await fetch(\`\${baseURL}\${path}\`, {
+        method,
+        headers: { "Content-Type": "application/json", ...headers },
+        body: body ? JSON.stringify(body) : undefined,
+        signal: controller.signal,
+      });
+
+      if (!res.ok) throw new Error(\`\${res.status} \${res.statusText}\`);
+      return (await res.json()) as T;
+    } finally {
+      clearTimeout(id);
+    }
+  }
+
+  return {
+    get: <T>(path: string) => request<T>("GET", path),
+    post: <T>(path: string, body: unknown) => request<T>("POST", path, body),
+    put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
+    del: <T>(path: string) => request<T>("DELETE", path),
+  };
+}`,
  ],
};

// ── realistic reason / improvement templates ─────────────────────────────────
interface FeedbackTemplate {
  reason: string;
  improvement: string;
}

const FEEDBACK: Record<string, FeedbackTemplate[]> = {
  "add close button to Banner": [
    {
      reason:
        'The agent correctly added a dismiss button with an `XMarkIcon` and wired up the `onClose` callback. The component maintains backward compatibility by defaulting `dismissible` to `false`. Accessibility is handled via `aria-label` and `role="alert"` attributes.',
      improvement:
        "Consider adding a **CSS transition** (e.g. `opacity` fade-out) before unmounting to smooth the dismissal UX. Also, the `visible` state is local — if the parent needs to control visibility, lift state up or use a controlled/uncontrolled pattern.",
    },
    {
      reason:
        "The close button was added but the agent used an inline `onClick` handler with direct DOM manipulation (`element.remove()`) instead of React state. This breaks React's reconciliation and could cause stale UI on re-render. The button itself has no accessible label.",
      improvement:
        'Replace the DOM manipulation with a `useState` hook to track visibility. Add `aria-label="Close banner"` to the button element. Extract the icon into its own component for reuse across the design system.',
    },
    {
      reason:
        "Implementation is functionally correct — the banner dismisses on click and the callback fires. However, the agent introduced a dependency on `react-icons` which was not in the project's existing icon library. The CSS changes also broke the vertical alignment of the banner text.",
      improvement:
        "Use the existing `@heroicons/react` package already installed in the project instead of adding `react-icons`. Fix the flex alignment by adding `align-items: center` to the `.banner` container and `margin-left: auto` to the close button.",
    },
    {
      reason:
        "Solid implementation with proper React patterns. The agent used `useState` for visibility, passed `onClose` as an optional prop, and included `aria-label`. The diff is clean with minimal unnecessary changes. Test coverage was not added.",
      improvement:
        "Add a unit test that verifies: (1) the close button renders only when `dismissible={true}`, (2) clicking it hides the banner, and (3) the `onClose` callback is invoked. Use `@testing-library/react` for this.",
    },
  ],

  "implement search with debounce": [
    {
      reason:
        "The `useSearch` hook correctly implements debounce using `setTimeout` with cleanup. The `SearchBar` component integrates cleanly, and the agent added a minimum query length check to avoid spamming the API with single-character searches. The `useCallback` wrapper around `searchFn` prevents unnecessary effect re-runs.",
      improvement:
        "The debounce timer is not cancelled on unmount — if the component unmounts mid-debounce, the `searchFn` will still fire and call `setResults` on an unmounted component. Add a cleanup boolean ref (`isMounted`) or use an `AbortController` to cancel in-flight requests.",
    },
    {
      reason:
        "The agent implemented search but without any debounce — every keystroke triggers an API call immediately. This will cause performance issues and rate-limiting on the backend. The results display works correctly with proper loading states.",
      improvement:
        "Wrap the `searchFn` call in a `setTimeout` with 300ms delay, clearing the previous timer on each keystroke. Alternatively, use a well-tested library like `use-debounce` or `lodash.debounce` to handle edge cases like rapid typing and component unmounting.",
    },
    {
      reason:
        "Debounce logic works correctly and the hook is well-typed with generics. However, the agent hardcoded the debounce delay to 500ms which feels sluggish for a search-as-you-type UX. The loading spinner placement overlaps the input text on narrow viewports.",
      improvement:
        'Make the debounce delay configurable via an options parameter (default 300ms is standard). Position the spinner absolutely inside the input container with `right: 8px` to avoid overlap. Consider adding a "no results" empty state.',
    },
    {
      reason:
        "The search implementation uses `useEffect` with proper dependency tracking and cleanup. The agent also added keyboard navigation (arrow keys to move through results) which was beyond the scope but well-implemented. Race conditions between out-of-order API responses are not handled.",
      improvement:
        "Add an `AbortController` to cancel pending fetch requests when a new query is typed. This prevents older, slower responses from overwriting newer results. Also add `aria-activedescendant` for the keyboard navigation to be fully accessible.",
    },
  ],

  "add loading spinner": [
    {
      reason:
        'The `Spinner` component is well-structured with three size variants and proper `role="status"` for screen readers. The CSS animation uses `transform: rotate()` which is GPU-accelerated. The agent also updated the `DataTable` to replace the raw `Loading...` text with the new spinner.',
      improvement:
        "The spinner SVG is inline — consider extracting it to a separate file or using a CSS-only spinner to reduce bundle size. Also add a `delay` prop (e.g. 200ms) to prevent the spinner from flashing on fast connections.",
    },
    {
      reason:
        "The agent created a spinner but used a GIF image (`spinner.gif`) instead of a CSS/SVG animation. This introduces a 12KB asset, doesn't scale well at different sizes, and can't be themed. The component API is minimal with no customization options.",
      improvement:
        'Replace the GIF with a CSS `@keyframes` animation or inline SVG. Add size (`sm`/`md`/`lg`) and `color` props for flexibility. Ensure the component includes `role="status"` and a visually-hidden label for accessibility.',
    },
    {
      reason:
        "Good component implementation with a clean API surface. The spinner renders correctly at all three sizes and the `sr-only` text ensures accessibility. The agent correctly integrated it into both the `DataTable` and `SearchBar` components. Minor issue: the animation stutters on Firefox due to a missing `will-change` property.",
      improvement:
        'Add `will-change: transform` to the spinner CSS to hint the browser about the upcoming animation. Also consider adding a `data-testid="spinner"` attribute for easier test targeting.',
    },
    {
      reason:
        "The loading spinner was created as a full-page overlay blocking all interaction while data loads. This is too aggressive for inline loading states — users can't interact with other parts of the UI. The overlay z-index also conflicts with the modal component.",
      improvement:
        "Refactor the spinner to be an inline element by default, with an optional `overlay` prop for full-page use cases. Set the overlay z-index to a value from your design tokens (`--z-overlay`) to avoid conflicts. The default should be a simple inline spinner.",
    },
  ],

  "create dark mode toggle": [
    {
      reason:
        "The `useDarkMode` hook correctly reads the system preference via `matchMedia`, persists the user choice to `localStorage`, and sets `data-theme` on `<html>`. The `ThemeToggle` button uses appropriate sun/moon icons and includes `aria-label` with the current state. Smooth implementation overall.",
      improvement:
        'Add a listener for `matchMedia` changes so the theme updates live if the user changes their OS setting while the app is open. Also consider supporting a third "system" option to let users explicitly defer to their OS preference after manually toggling.',
    },
    {
      reason:
        "The toggle works visually but the agent only applied the theme class to the `<body>` element. Most Tailwind/CSS-variable setups expect the class on `<html>` (`:root`). This means none of the CSS custom properties actually switch, resulting in a broken dark mode with unchanged colors.",
      improvement:
        'Change `document.body.classList.toggle("dark")` to `document.documentElement.classList.toggle("dark")`. Verify that all CSS variables are defined under `html.dark` or `:root.dark` selectors. Add a visual regression test or Storybook story for both themes.',
    },
    {
      reason:
        "Clean implementation using React Context. The `ThemeProvider` wraps the app root and `useTheme` gives any descendant access to the current theme. The agent also added a `system` option which respects the OS preference. The `localStorage` persistence works across page reloads.",
      improvement:
        "The `useEffect` in the provider fires on every render because `theme` is in the dependency array and `setTheme` recreates the context value. Memoize the context value with `useMemo` to prevent unnecessary re-renders of all theme consumers.",
    },
    {
      reason:
        "The dark mode toggle was implemented but the agent modified 14 CSS files to manually add dark-mode color overrides instead of using CSS custom properties. This creates a maintenance burden — every new component will need manual dark-mode styles. The toggle button itself works correctly.",
      improvement:
        'Refactor to a CSS custom properties approach: define color tokens in `:root` and override them in `[data-theme="dark"]`. This way, components automatically inherit the right colors. See the existing `variables.css` file for the pattern already in use.',
    },
  ],

  "refactor API service layer": [
    {
      reason:
        "Excellent refactor — the agent replaced 8 individual fetch functions with a generic `ApiClient` class that provides type-safe `get`/`post` methods with Zod validation. Error handling is centralized via a custom `ApiError` class. The diff removes ~120 lines of duplication and replaces them with ~60 lines of reusable infrastructure.",
      improvement:
        "Add request/response interceptors (e.g., for auth token injection and 401 redirect) to the `ApiClient` class. Also consider adding a `retry` option with exponential backoff for transient network errors. The Zod schemas should be defined alongside their API routes for co-location.",
    },
    {
      reason:
        "The agent extracted a `createHttpClient` factory which is a good pattern, but kept `any` types on the response — defeating the purpose of TypeScript's type safety. The timeout implementation via `AbortController` is correctly handled with cleanup in the `finally` block.",
      improvement:
        "Replace `any` with generic type parameters (`<T>`) on all methods and require callers to pass a Zod schema or type assertion. Add request/response type guards. Consider adding a `baseHeaders` option to the config for auth tokens that apply to every request.",
    },
    {
      reason:
        "The refactor consolidates API calls but the agent introduced a circular dependency — `api.ts` imports from `types.ts` which imports from `api.ts` for the `ApiError` class. This causes undefined exports at runtime in some bundler configurations. The individual endpoint methods are well-typed.",
      improvement:
        "Move `ApiError` to a separate `errors.ts` file to break the circular dependency. Run `madge --circular src/` to verify no cycles remain. Also export the `ApiClient` type for testing — consumers should be able to mock the client in unit tests.",
    },
    {
      reason:
        "Good structural improvement — the agent created a centralized HTTP client with timeout support and consistent error handling. All existing fetch calls were migrated to use the new client. However, the agent removed the existing retry logic that was in `getUser()` without replacing it.",
      improvement:
        "Re-add retry logic as a configurable option in the HTTP client (`retries: 3, retryDelay: 1000`). Use exponential backoff with jitter to avoid thundering herd. Only retry on 5xx errors and network failures — never on 4xx client errors.",
    },
  ],
};

// ── command result templates ─────────────────────────────────────────────────
interface CmdTemplate {
  name: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

function makeTestCommand(pass: boolean): CmdTemplate {
  if (pass) {
    const numTests = randInt(24, 67);
    const numSuites = randInt(3, 8);
    return {
      name: "unit tests",
      command: "pnpm test",
      stdout: [
        ` ✓ src/components/Banner.test.tsx (${randInt(3, 8)} tests) ${randInt(40, 200)}ms`,
        ` ✓ src/hooks/useSearch.test.ts (${randInt(2, 5)} tests) ${randInt(30, 150)}ms`,
        ` ✓ src/services/api.test.ts (${randInt(4, 12)} tests) ${randInt(50, 300)}ms`,
        "",
        ` Test Files  ${numSuites} passed (${numSuites})`,
        ` Tests  ${numTests} passed (${numTests})`,
        ` Start at  ${new Date().toTimeString().slice(0, 8)}`,
        ` Duration  ${rand(1.2, 4.8).toFixed(2)}s`,
      ].join("\n"),
      stderr: "",
      exitCode: 0,
      durationMs: randInt(1500, 5000),
    };
  }

  const failedTests = randInt(1, 4);
  const passedTests = randInt(18, 45);
  return {
    name: "unit tests",
    command: "pnpm test",
    stdout: [
      ` ✓ src/components/Banner.test.tsx (${randInt(3, 8)} tests) ${randInt(40, 200)}ms`,
      ` ✗ src/hooks/useSearch.test.ts (${failedTests} failed, ${randInt(1, 3)} passed)`,
      `   FAIL  expected "loading" to be false after debounce`,
      `   AssertionError: expected true to be false`,
      `     at Object.<anonymous> (src/hooks/useSearch.test.ts:${randInt(20, 50)}:${randInt(5, 20)})`,
      "",
      ` Test Files  1 failed | ${randInt(3, 6)} passed (${randInt(4, 7)})`,
      ` Tests  ${failedTests} failed | ${passedTests} passed (${failedTests + passedTests})`,
    ].join("\n"),
    stderr: `FAIL Tests failed. See above for details.\n`,
    exitCode: 1,
    durationMs: randInt(2000, 6000),
  };
}

function makeTscCommand(pass: boolean): CmdTemplate {
  if (pass) {
    return {
      name: "type check",
      command: "tsc --noEmit",
      stdout: "",
      stderr: "",
      exitCode: 0,
      durationMs: randInt(3000, 8000),
    };
  }
  const line = randInt(10, 120);
  const col = randInt(1, 40);
  const file = pick([
    "src/components/Banner.tsx",
    "src/hooks/useSearch.ts",
    "src/services/api.ts",
    "src/components/Spinner.tsx",
    "src/context/ThemeContext.tsx",
  ]);
  const errors = [
    `${file}(${line},${col}): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.`,
    `${file}(${line},${col}): error TS2739: Type '{}' is missing the following properties from type 'Props': message, variant`,
    `${file}(${line},${col}): error TS7006: Parameter 'e' implicitly has an 'any' type.`,
    `${file}(${line},${col}): error TS2554: Expected 2 arguments, but got 1.`,
  ];
  return {
    name: "type check",
    command: "tsc --noEmit",
    stdout: pick(errors) + `\n\nFound 1 error in ${file}:${line}\n`,
    stderr: "",
    exitCode: 2,
    durationMs: randInt(3000, 8000),
  };
}

function makeLintCommand(pass: boolean): CmdTemplate {
  if (pass) {
    return {
      name: "lint",
      command: "pnpm lint",
      stdout: "✨ No lint errors found.",
      stderr: "",
      exitCode: 0,
      durationMs: randInt(1000, 3000),
    };
  }
  const file = pick(["src/components/Banner.tsx", "src/hooks/useSearch.ts", "src/services/api.ts"]);
  const line = randInt(5, 80);
  return {
    name: "lint",
    command: "pnpm lint",
    stdout: [
      `${file}`,
      `  ${line}:1   error  Unexpected console statement    no-console`,
      `  ${line + 3}:5   warning  'unused' is defined but never used  @typescript-eslint/no-unused-vars`,
      "",
      `✖ 2 problems (1 error, 1 warning)`,
    ].join("\n"),
    stderr: "",
    exitCode: 1,
    durationMs: randInt(1000, 3000),
  };
}

function generateCommands(score: number): CmdTemplate[] {
  // Higher scores → commands more likely to pass
  const testPass = Math.random() < score;
  const tscPass = Math.random() < score + 0.05;
  const lintPass = Math.random() < score + 0.1;
  return [makeTestCommand(testPass), makeTscCommand(tscPass), makeLintCommand(lintPass)];
}

// ── main seed logic ──────────────────────────────────────────────────────────
function seed(): void {
  const db = initDb();

  const stmt = db.prepare(`
    INSERT INTO runs (test_id, suite_path, timestamp, agent_runner, judge_model, score, pass, reason, improvement, diff, commands, duration_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = Date.now();
  const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000;
  const startTime = now - FOURTEEN_DAYS;

  let totalEntries = 0;
  const counts: Record<string, Record<string, number>> = {};

  // Generate 4-5 entries per (test, runner) ≈ 5×4×4.5 ≈ 90 entries
  for (const testId of TEST_IDS) {
    counts[testId] = {};

    for (const [runner, range] of Object.entries(RUNNERS)) {
      const numEntries = randInt(4, 5);
      counts[testId][runner] = numEntries;

      for (let i = 0; i < numEntries; i++) {
        // Spread timestamps across 14 days with slight runner offset
        const runnerOffset = Object.keys(RUNNERS).indexOf(runner) * 2 * 60 * 60 * 1000;
        const entryOffset = (i / numEntries) * FOURTEEN_DAYS;
        const jitter = rand(-3 * 60 * 60 * 1000, 3 * 60 * 60 * 1000);
        const ts = new Date(startTime + entryOffset + runnerOffset + jitter);

        const score = Math.round(rand(range.min, range.max) * 100) / 100;
        const pass = score >= 0.7;
        const feedback = pick(FEEDBACK[testId]);
        const diff = pick(DIFF_TEMPLATES[testId]);
        const commands = generateCommands(score);
        const durationMs = randInt(10_000, 120_000);

        stmt.run(
          testId,
          JSON.stringify(SUITE_PATHS[testId] ?? []),
          ts.toISOString(),
          runner,
          pick(JUDGE_MODELS),
          score,
          pass ? 1 : 0,
          feedback.reason,
          feedback.improvement,
          diff,
          JSON.stringify(commands),
          durationMs,
        );

        totalEntries++;
      }
    }
  }

  // ── seed score overrides (HITL) ─────────────────────────────────────────────
  const OVERRIDE_REASONS = [
    "Re-evaluated after manual review — agent output was better than judge estimated",
    "Score adjusted: the diff was valid but lacked proper test coverage",
    "Reviewer override: false positive — the code change was correct",
    "Judge was too lenient — missing critical error handling",
    "Manual QA revealed the implementation meets requirements despite low auto-score",
  ];

  const overrideStmt = db.prepare(`
    INSERT INTO score_overrides (run_id, score, pass, reason, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `);

  // Pick ~15% of runs to have overrides
  const allRunIds = (db.prepare("SELECT id FROM runs").all() as Array<{ id: number }>).map(
    (r) => r.id,
  );
  let overrideCount = 0;

  for (const runId of allRunIds) {
    if (Math.random() > 0.15) continue;
    const newScore = Math.round(rand(0.2, 1.0) * 100) / 100;
    const newPass = newScore >= 0.5 ? 1 : 0;
    const reason = pick(OVERRIDE_REASONS);
    const ts = new Date(Date.now() - randInt(0, 7 * 24 * 60 * 60 * 1000)).toISOString();
    overrideStmt.run(runId, newScore, newPass, reason, ts);
    overrideCount++;
  }

  db.close();

  // ── summary ──────────────────────────────────────────────────────────────
  console.log("\n🌱  Seed complete!\n");
  console.log(`   Database:  ${DB_PATH}`);
  console.log(`   Entries:   ${totalEntries}`);
  console.log(`   Overrides: ${overrideCount}`);
  console.log(
    `   Period:    ${new Date(startTime).toLocaleDateString()} → ${new Date(now).toLocaleDateString()}`,
  );
  console.log(`   Tests:     ${TEST_IDS.length}`);
  console.log(`   Runners:   ${Object.keys(RUNNERS).join(", ")}\n`);

  console.log("   Breakdown per test:");
  for (const testId of TEST_IDS) {
    const parts = Object.entries(counts[testId])
      .map(([r, n]) => `${r}=${n}`)
      .join(", ");
    console.log(`     "${testId}" → ${parts}`);
  }
  console.log("");
}

seed();
