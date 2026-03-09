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
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      test_id             TEXT    NOT NULL,
      suite_path          TEXT    NOT NULL DEFAULT '[]',
      timestamp           TEXT    NOT NULL,
      agent_runner        TEXT    NOT NULL,
      instruction         TEXT    NOT NULL DEFAULT '',
      diff                TEXT,
      changed_files       TEXT    NOT NULL DEFAULT '[]',
      commands            TEXT,
      task_results        TEXT    NOT NULL DEFAULT '[]',
      agent_token_usage   TEXT,
      timing              TEXT    NOT NULL DEFAULT '{}',
      agent_output        TEXT,
      logs                TEXT    NOT NULL DEFAULT '',
      judge_model         TEXT    NOT NULL,
      score               REAL    NOT NULL,
      pass                INTEGER NOT NULL,
      status              TEXT    NOT NULL DEFAULT 'FAIL',
      reason              TEXT    NOT NULL,
      improvement         TEXT    NOT NULL DEFAULT '',
      tags                TEXT    NOT NULL DEFAULT '[]',
      judge_token_usage   TEXT,
      criteria            TEXT    NOT NULL DEFAULT '',
      expected_files      TEXT,
      warn_threshold      REAL    NOT NULL DEFAULT 0.8,
      fail_threshold      REAL    NOT NULL DEFAULT 0.5,
      duration_ms         INTEGER NOT NULL,
      variant_name        TEXT,
      base_prompt         TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_runs_test_id  ON runs(test_id);
    CREATE INDEX IF NOT EXISTS idx_runs_timestamp ON runs(timestamp);

    CREATE TABLE IF NOT EXISTS score_overrides (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id    INTEGER NOT NULL REFERENCES runs(id),
      score     REAL    NOT NULL,
      pass      INTEGER NOT NULL,
      status    TEXT    NOT NULL DEFAULT 'FAIL',
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
function pick<T>(arr: readonly T[]): T {
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

const SUITE_PATHS: Record<string, string[]> = {
  "add close button to Banner": ["UI Components", "Banner"],
  "implement search with debounce": ["UI Components", "Search"],
  "add loading spinner": ["UI Components"],
  "create dark mode toggle": ["Theme"],
  "refactor API service layer": [],
};

const RUNNERS: Record<string, { min: number; max: number }> = {
  copilot: { min: 0.7, max: 0.95 },
  cursor: { min: 0.6, max: 0.9 },
  "claude-code": { min: 0.75, max: 0.98 },
  aider: { min: 0.5, max: 0.85 },
};

const VARIANTS = ["Baseline", "Expert Persona", "Detailed Specs"] as const;
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
+}`,
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
  ],
};

interface FeedbackTemplate {
  reason: string;
  improvement: string;
}

const FEEDBACK: Record<string, FeedbackTemplate[]> = {
  "add close button to Banner": [
    {
      reason: "Correctly implemented using React state and aria-label.",
      improvement: "Add a CSS transition for better UX.",
    },
  ],
  "implement search with debounce": [
    {
      reason: "Hook handles debouncing correctly.",
      improvement: "Use AbortController to handle race conditions.",
    },
  ],
  "add loading spinner": [
    {
      reason: "Clean SVG-based spinner with accessibility support.",
      improvement: "Extract to a reusable component.",
    },
  ],
  "create dark mode toggle": [
    {
      reason: "Respects system preference and persists to localStorage.",
      improvement: "Use CSS custom properties for cleaner theming.",
    },
  ],
  "refactor API service layer": [
    {
      reason: "Centralized client reduces boilerplate and improves typing.",
      improvement: "Add retry logic for transient errors.",
    },
  ],
};

function generateTokenUsage(): { inputTokens: number; outputTokens: number; totalTokens: number } {
  const input = randInt(1000, 4000);
  const output = randInt(200, 1000);
  return { inputTokens: input, outputTokens: output, totalTokens: input + output };
}

function generateTiming(durationMs: number): any {
  return { totalMs: durationMs, agentMs: durationMs * 0.8, judgeMs: durationMs * 0.1 };
}

function seed(): void {
  const db = initDb();

  const stmt = db.prepare(`
    INSERT INTO runs (
      test_id, suite_path, timestamp, agent_runner, instruction,
      diff, changed_files, commands, task_results,
      agent_token_usage, timing, agent_output, logs,
      judge_model, score, pass, status, reason, improvement,
      judge_token_usage, criteria, expected_files,
      warn_threshold, fail_threshold, duration_ms,
      variant_name, base_prompt
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = Date.now();
  for (const testId of TEST_IDS) {
    for (const [runner, range] of Object.entries(RUNNERS)) {
      const ts = new Date(now - randInt(0, 14 * 24 * 60 * 60 * 1000));
      const score = Math.round(rand(range.min, range.max) * 100) / 100;
      const status = score >= 0.8 ? "PASS" : score >= 0.5 ? "WARN" : "FAIL";
      const feedback = pick(FEEDBACK[testId] || [{ reason: "ok", improvement: "" }]);
      const variantName = pick(VARIANTS);

      stmt.run(
        testId,
        JSON.stringify(SUITE_PATHS[testId] ?? []),
        ts.toISOString(),
        runner,
        "Instruction",
        pick(DIFF_TEMPLATES[testId] ?? [""]),
        JSON.stringify(["src/file.ts"]),
        "[]", // commands
        "[]", // task_results
        JSON.stringify(generateTokenUsage()),
        JSON.stringify(generateTiming(30000)),
        null,
        "",
        pick(JUDGE_MODELS),
        score,
        status === "FAIL" ? 0 : 1,
        status,
        feedback.reason,
        feedback.improvement,
        JSON.stringify(generateTokenUsage()),
        "Criteria",
        "[]",
        0.8,
        0.5,
        30000,
        variantName,
        "Base prompt",
      );
    }
  }

  db.close();
  console.log("\n🌱 Seed complete!\n");
}

seed();
