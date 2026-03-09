/**
 * Enhanced Seed script – populates .agenteval/ledger.sqlite with rich, diverse test data.
 * Includes: Nested suites, Tags, Varied metrics, and realistic AB test scenarios.
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

// ── schema ───────────────────────────────────────────────────────────────────
function initDb(): InstanceType<typeof DatabaseSync> {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  try {
    rmSync(DB_PATH);
  } catch {
    /* ignore */
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
function pickMany<T>(arr: readonly T[], count: number): T[] {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// ── data definitions ─────────────────────────────────────────────────────────
const SUITE_TEMPLATES = [
  ["Core", "Engine"],
  ["UI", "Components", "Buttons"],
  ["UI", "Layouts"],
  ["Features", "Auth", "OAuth"],
  ["Features", "Search", "Indexing"],
  ["Refactors", "Cleanup"],
  ["Regression"],
];

const TAG_OPTIONS = [
  "high-priority",
  "regression",
  "perf-critical",
  "experimental",
  "v2-release",
  "bug-fix",
  "mcp-enabled",
];

const VARIANT_PROFILES = [
  { name: "baseline", score: [0.4, 0.6], speed: 1.0, tokens: 1.0 },
  { name: "with-skills-v1", score: [0.6, 0.8], speed: 0.8, tokens: 0.9 },
  { name: "with-mcp-server", score: [0.75, 0.95], speed: 0.7, tokens: 0.75 },
  { name: "skill-v2-optimized", score: [0.85, 1.0], speed: 0.5, tokens: 0.6 },
];

const TEST_SCENARIOS = [
  {
    id: "login-validation-fix",
    instruction: "Fix the regex for email validation in the login form to allow .dev domains.",
    files: ["src/auth/validation.ts", "src/auth/validation.test.ts"],
    criteria: "Emails ending in .dev should be accepted. Unit tests must pass.",
  },
  {
    id: "button-glassmorphism",
    instruction: "Update the primary button component to use a translucent glassmorphism style.",
    files: ["src/components/Button.tsx", "src/components/Button.module.css"],
    criteria:
      "Background should have backdrop-blur and border-opacity. Contrast ratios must be kept.",
  },
  {
    id: "search-indexing-speed",
    instruction:
      "Refactor the search indexing loop to use a more efficient data structure (Map instead of Array search).",
    files: ["src/engine/indexer.ts"],
    criteria: "Search complexity should drop from O(n) to O(1) for lookups.",
  },
  {
    id: "mcp-database-connector",
    instruction:
      "Implement a new MCP tool to query the local SQLite database for schema inspection.",
    files: ["mcp/db-server.ts", "mcp/db-server.test.ts"],
    criteria:
      "The tool should return a list of tables and their column definitions in JSON format.",
  },
];

const RUNNERS = ["gpt-4o", "claude-3-5-sonnet", "deepseek-v3"];
const JUDGE_MODELS = ["gpt-4o", "claude-3-5-sonnet-judge"];

// ── main seed logic ──────────────────────────────────────────────────────────
function seed(): void {
  const db = initDb();
  const stmt = db.prepare(`
    INSERT INTO runs (
      test_id, suite_path, timestamp, agent_runner, instruction,
      diff, changed_files, commands, task_results,
      agent_token_usage, timing, agent_output, logs,
      judge_model, score, pass, status, reason, improvement,
      tags, judge_token_usage, criteria, expected_files,
      warn_threshold, fail_threshold, duration_ms,
      variant_name, base_prompt
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = Date.now();
  let totalEntries = 0;

  for (const scenario of TEST_SCENARIOS) {
    const suite = pick(SUITE_TEMPLATES);
    const baseTags = pickMany(TAG_OPTIONS, randInt(1, 3));

    for (const runner of RUNNERS) {
      for (const profile of VARIANT_PROFILES) {
        // 5 runs per variant to show consistent averages and some variance
        for (let i = 0; i < 5; i++) {
          const ts = new Date(now - randInt(0, 30 * 24 * 60 * 60 * 1000));

          // Calculate varied performance based on profile
          const baseScore = rand(profile.score[0], profile.score[1]);
          const noise = rand(-0.05, 0.05);
          const score = Math.min(1, Math.max(0, baseScore + noise));

          const durationBase = randInt(15000, 60000);
          const durationMs = durationBase * profile.speed;

          const tokensBase = randInt(1000, 8000);
          const tokens = tokensBase * profile.tokens;

          const status = score >= 0.8 ? "PASS" : score >= 0.5 ? "WARN" : "FAIL";

          // Realistic diff mockup
          const diff = `diff --git a/${scenario.files[0]} b/${scenario.files[0]}
index 1234567..abcdefg 100644
--- a/${scenario.files[0]}
+++ b/${scenario.files[0]}
@@ -10,5 +10,5 @@
- const oldLogic = true;
+ const newLogic = ${profile.name.includes("v2") ? "true /* optimized */" : "true"};
`;

          stmt.run(
            scenario.id,
            JSON.stringify(suite),
            ts.toISOString(),
            runner,
            scenario.instruction,
            diff,
            JSON.stringify(scenario.files),
            "[]", // commands
            "[]", // task_results
            JSON.stringify({
              inputTokens: Math.floor(tokens * 0.7),
              outputTokens: Math.floor(tokens * 0.3),
              totalTokens: Math.floor(tokens),
            }),
            JSON.stringify({
              totalMs: durationMs,
              agentMs: durationMs * 0.85,
              judgeMs: durationMs * 0.1,
            }),
            "Agent executed successfully.",
            "Full execution logs...",
            pick(JUDGE_MODELS),
            Math.round(score * 100) / 100,
            status === "FAIL" ? 0 : 1,
            status,
            `The agent used the ${profile.name} strategy. Evaluation shows good adherence to criteria with minor optimizations needed.`,
            `To reach a perfect score, consider ${pick(["better error handling", "more unit tests", "cleaner code structure"])}.`,
            JSON.stringify([...baseTags, profile.name]),
            JSON.stringify({ inputTokens: 1200, outputTokens: 300, totalTokens: 1500 }),
            scenario.criteria,
            JSON.stringify(scenario.files),
            0.8,
            0.5,
            Math.round(durationMs),
            profile.name,
            scenario.instruction,
          );
          totalEntries++;
        }
      }
    }
  }

  db.close();
  console.log(`\n🌱  Rich Database Seeded!`);
  console.log(`    Total Runs:  ${totalEntries}`);
  console.log(`    Suites:      ${SUITE_PATHS_COUNT(TEST_SCENARIOS.length)} nested structures`);
  console.log(`    Variants:    Baseline, Skills, MCP, Optimized v2`);
  console.log(`    Tags:        Diverse technical metadata\n`);
}

function SUITE_PATHS_COUNT(n: number) {
  return n;
}

seed();
