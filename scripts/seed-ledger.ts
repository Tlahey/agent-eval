/**
 * Seed script – populates .agenteval/ledger.sqlite with realistic test data.
 * Rich A/B Testing scenarios: Baseline, Skills, MCP, Versioning.
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

// ── A/B Variations Configuration ─────────────────────────────────────────────
interface VariantProfile {
  name: string;
  scoreBoost: number;
  speedBoost: number; // multiplier (0.8 = 20% faster)
  tokenEfficiency: number; // multiplier (0.9 = 10% less tokens)
}

const VARIANT_PROFILES: VariantProfile[] = [
  { name: "baseline", scoreBoost: 0, speedBoost: 1, tokenEfficiency: 1 },
  { name: "with skills", scoreBoost: 0.15, speedBoost: 0.85, tokenEfficiency: 0.95 },
  { name: "with MCP", scoreBoost: 0.22, speedBoost: 0.75, tokenEfficiency: 0.8 },
  { name: "skill-v2-optimized", scoreBoost: 0.28, speedBoost: 0.6, tokenEfficiency: 0.7 },
];

const TEST_IDS = [
  "complex-refactoring-task",
  "bug-fix-edge-case",
  "new-feature-implementation",
] as const;

const RUNNERS = ["gpt-4o", "claude-3-5-sonnet"];

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
    for (const runner of RUNNERS) {
      for (const profile of VARIANT_PROFILES) {
        // Generate 3 runs per variant to have a good average
        for (let i = 0; i < 3; i++) {
          const ts = new Date(now - randInt(0, 7 * 24 * 60 * 60 * 1000));

          // Base stats for the runner
          let score = rand(0.5, 0.7) + profile.scoreBoost;
          score = Math.min(1, Math.max(0, score));

          const durationMs = randInt(20000, 45000) * profile.speedBoost;
          const tokens = randInt(2000, 5000) * profile.tokenEfficiency;

          const status = score >= 0.8 ? "PASS" : score >= 0.5 ? "WARN" : "FAIL";
          const pass = status !== "FAIL" ? 1 : 0;

          stmt.run(
            testId,
            JSON.stringify(["AB Tests"]),
            ts.toISOString(),
            runner,
            `Instruction for ${testId}`,
            "diff content",
            JSON.stringify(["src/main.ts"]),
            "[]",
            "[]",
            JSON.stringify({
              inputTokens: tokens * 0.6,
              outputTokens: tokens * 0.4,
              totalTokens: tokens,
            }),
            JSON.stringify({
              totalMs: durationMs,
              agentMs: durationMs * 0.8,
              judgeMs: durationMs * 0.15,
            }),
            null,
            "",
            "gpt-4o",
            Math.round(score * 100) / 100,
            pass,
            status,
            `Reasoning for ${profile.name}`,
            `Improvement for ${profile.name}`,
            JSON.stringify({ totalTokens: 1200 }),
            "Criteria text",
            "[]",
            0.8,
            0.5,
            Math.round(durationMs),
            profile.name,
            "Base prompt text",
          );
        }
      }
    }
  }

  db.close();
  console.log("\n🌱 Rich A/B scenarios seeded!");
  console.log("   Variants: baseline, with skills, with MCP, skill-v2-optimized\n");
}

seed();
