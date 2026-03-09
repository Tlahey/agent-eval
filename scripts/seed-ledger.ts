/**
 * Ultimate Seed script – combines high-quality content with the new architecture.
 * Scenarios: Banner, Search, Spinner, Dark Mode, API Refactor.
 * Support for: Variants, Delta Analysis, Required Commands, Deep Nesting.
 */

import { mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
// @ts-expect-error -- node:sqlite has no stable types yet
import { DatabaseSync } from "node:sqlite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUTPUT_DIR = join(ROOT, ".agenteval");
const DB_PATH = join(OUTPUT_DIR, "ledger.sqlite");

function initDb(): InstanceType<typeof DatabaseSync> {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  try {
    rmSync(DB_PATH);
  } catch {
    // Ignore if file doesn't exist
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
      base_prompt         TEXT,
      required_commands   TEXT
    );
    CREATE TABLE IF NOT EXISTS score_overrides (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id    INTEGER NOT NULL REFERENCES runs(id),
      score     REAL    NOT NULL,
      pass      INTEGER NOT NULL,
      status    TEXT    NOT NULL DEFAULT 'FAIL',
      reason    TEXT    NOT NULL,
      timestamp TEXT    NOT NULL
    );
  `);
  return db;
}

const RUNNERS = ["gpt-4o", "claude-3-5-sonnet", "aider-cli"];
const VARIANTS = [
  { name: "baseline", scoreBoost: 0, speedBoost: 1, tokenEfficiency: 1 },
  { name: "with skills", scoreBoost: 0.12, speedBoost: 0.8, tokenEfficiency: 0.9 },
  { name: "with MCP", scoreBoost: 0.2, speedBoost: 0.7, tokenEfficiency: 0.8 },
  { name: "optimized v2", scoreBoost: 0.25, speedBoost: 0.5, tokenEfficiency: 0.65 },
];

const SCENARIOS = [
  {
    id: "add-close-button",
    suite: ["UI", "Components", "Banner"],
    instruction:
      "Add a Close button to the Banner component in src/Banner.tsx. It should handle onClose callback.",
    criteria: "Proper React state usage, aria-label included, callback invoked on click.",
    files: ["src/Banner.tsx", "src/Banner.test.tsx"],
    required: ["pnpm test"],
    diffs: [
      `diff --git a/src/Banner.tsx b/src/Banner.tsx
index 1234567..abcdefg 100644
--- a/src/Banner.tsx
+++ b/src/Banner.tsx
@@ -1,4 +1,8 @@
 import React from "react";
+import { IoClose } from "react-icons/io5";
 
 export const Banner = ({ text, onClose }) => {
-  return <div className="banner">{text}</div>;
+  return (
+    <div className="banner" role="alert">
+      {text}
+      <button onClick={onClose} aria-label="Close"><IoClose /></button>
+    </div>
+  );
 };`,
    ],
  },
  {
    id: "implement-search-debounce",
    suite: ["Features", "Search"],
    instruction: "Implement a useSearch hook with 300ms debounce for the search bar.",
    criteria: "Debounce logic should prevent excessive API calls. Cleanup on unmount.",
    files: ["src/hooks/useSearch.ts"],
    required: ["pnpm build"],
    diffs: [
      `diff --git a/src/hooks/useSearch.ts b/src/hooks/useSearch.ts
new file mode 100644
index 0000000..a7c3e29
--- /dev/null
+++ b/src/hooks/useSearch.ts
@@ -0,0 +1,38 @@
+import { useState, useEffect, useRef } from "react";
+export function useSearch(searchFn, delay = 300) {
+  const [query, setQuery] = useState("");
+  useEffect(() => {
+    const handler = setTimeout(() => searchFn(query), delay);
+    return () => clearTimeout(handler);
+  }, [query, delay]);
+  return { setQuery };
+}`,
    ],
  },
  {
    id: "api-refactor",
    suite: ["Core", "Services"],
    instruction: "Refactor the fetch calls to use a centralized ApiClient with Zod validation.",
    criteria: "Type-safety ensured, error handling centralized, code duplication removed.",
    files: ["src/lib/api.ts"],
    required: ["pnpm build", "pnpm test"],
    diffs: [
      `diff --git a/src/lib/api.ts b/src/lib/api.ts
index 9f8e2a1..c4d1b73 100644
--- a/src/lib/api.ts
+++ b/src/lib/api.ts
+import { z } from "zod";
+class ApiClient {
+  async get(path, schema) {
+    const res = await fetch(path);
+    return schema.parse(await res.json());
+  }
+}
+export const api = new ApiClient();`,
    ],
  },
];

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}
function randInt(min: number, max: number) {
  return Math.floor(rand(min, max + 1));
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function seed() {
  const db = initDb();
  const stmt = db.prepare(`
    INSERT INTO runs (
      test_id, suite_path, timestamp, agent_runner, instruction,
      diff, changed_files, commands, task_results,
      agent_token_usage, timing, agent_output, logs,
      judge_model, score, pass, status, reason, improvement,
      tags, judge_token_usage, criteria, expected_files,
      warn_threshold, fail_threshold, duration_ms,
      variant_name, base_prompt, required_commands
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = Date.now();
  let total = 0;

  for (const s of SCENARIOS) {
    for (const runner of RUNNERS) {
      for (const variant of VARIANTS) {
        // 4 iterations per variant for stability metrics
        for (let i = 0; i < 4; i++) {
          const ts = new Date(now - randInt(0, 30 * 24 * 60 * 60 * 1000));
          const scoreBase = rand(0.4, 0.7) + variant.scoreBoost;
          const score = Math.min(1, Math.max(0, scoreBase + rand(-0.05, 0.05)));
          const duration = randInt(15000, 45000) * variant.speedBoost;
          const tokens = randInt(1000, 6000) * variant.tokenEfficiency;
          const status = score >= 0.8 ? "PASS" : score >= 0.5 ? "WARN" : "FAIL";

          stmt.run(
            s.id,
            JSON.stringify(s.suite),
            ts.toISOString(),
            runner,
            s.instruction,
            pick(s.diffs),
            JSON.stringify(s.files),
            "[]",
            "[]",
            JSON.stringify({
              inputTokens: tokens * 0.7,
              outputTokens: tokens * 0.3,
              totalTokens: tokens,
            }),
            JSON.stringify({
              totalMs: duration,
              agentMs: duration * 0.8,
              judgeMs: duration * 0.15,
            }),
            "Agent executed successfully.",
            "Full logs...",
            "gpt-4o",
            Math.round(score * 100) / 100,
            status === "FAIL" ? 0 : 1,
            status,
            `Variant ${variant.name} evaluation. Score: ${score.toFixed(2)}.`,
            "Consider improving error handling.",
            JSON.stringify(["ui", "refactor", variant.name]),
            JSON.stringify({ inputTokens: 1200, outputTokens: 300, totalTokens: 1500 }),
            s.criteria,
            JSON.stringify(s.files),
            0.8,
            0.5,
            Math.round(duration),
            variant.name,
            s.instruction,
            JSON.stringify(s.required),
          );
          total++;
        }
      }
    }
  }

  db.close();
  console.log(`\n🌱  Database repopulated with high-quality content!`);
  console.log(`    Total Runs: ${total}\n`);
}

seed();
