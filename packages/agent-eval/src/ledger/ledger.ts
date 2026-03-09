/**
 * SQLite Ledger implementation using Node 22's native node:sqlite.
 */

import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";
import { mkdirSync, existsSync } from "node:fs";
import type {
  LedgerEntry,
  TaskResult,
  TimingData,
  TokenUsage,
  CommandResult,
  TestStatus,
  ScoreOverride,
} from "../core/types.js";
import { computeStatus } from "../core/types.js";
import type { TestTreeNode, RunnerStats } from "../core/interfaces.js";

function dbPath(outputDir: string): string {
  return resolve(process.cwd(), outputDir, "ledger.sqlite");
}

function openDb(outputDir: string): any {
  mkdirSync(resolve(process.cwd(), outputDir), { recursive: true });
  const db = new DatabaseSync(dbPath(outputDir));

  // 1. Initial schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      test_id             TEXT    NOT NULL,
      suite_path          TEXT    NOT NULL,
      timestamp           TEXT    NOT NULL,
      agent_runner        TEXT    NOT NULL,
      instruction         TEXT    NOT NULL,
      diff                TEXT,
      changed_files       TEXT    NOT NULL,
      commands            TEXT    NOT NULL,
      task_results        TEXT    NOT NULL,
      agent_token_usage   TEXT,
      timing              TEXT    NOT NULL,
      agent_output        TEXT,
      logs                TEXT    NOT NULL,
      judge_model         TEXT    NOT NULL,
      score               REAL    NOT NULL,
      pass                INTEGER NOT NULL,
      status              TEXT    NOT NULL,
      reason              TEXT    NOT NULL,
      improvement         TEXT    NOT NULL,
      tags                TEXT    NOT NULL,
      judge_token_usage   TEXT,
      criteria            TEXT    NOT NULL,
      expected_files      TEXT,
      warn_threshold      REAL    NOT NULL DEFAULT 0.8,
      fail_threshold      REAL    NOT NULL DEFAULT 0.5,
      duration_ms         INTEGER NOT NULL,
      override            TEXT,
      variant_name        TEXT,
      base_prompt         TEXT
    );
  `);

  // Migration: Add columns if missing (legacy support)
  const columnsToAdd = [
    { name: "tags", type: "TEXT NOT NULL DEFAULT '[]'" },
    { name: "variant_name", type: "TEXT" },
    { name: "base_prompt", type: "TEXT" },
  ];

  for (const col of columnsToAdd) {
    try {
      db.exec(`ALTER TABLE runs ADD COLUMN ${col.name} ${col.type}`);
    } catch {
      // Column already exists
    }
  }

  return db;
}

// ─── Row ↔ LedgerEntry mapping ───

interface RunRow {
  id: number;
  test_id: string;
  suite_path: string;
  timestamp: string;
  agent_runner: string;
  instruction: string;
  diff: string | null;
  changed_files: string;
  commands: string;
  task_results: string;
  agent_token_usage: string | null;
  timing: string;
  agent_output: string | null;
  logs: string;
  judge_model: string;
  score: number;
  pass: number;
  status: string;
  reason: string;
  improvement: string;
  tags: string;
  judge_token_usage: string | null;
  criteria: string;
  expected_files: string | null;
  warn_threshold: number;
  fail_threshold: number;
  duration_ms: number;
  override: string | null;
  variant_name: string | null;
  base_prompt: string | null;
}

function safeJsonParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

function rowToEntry(row: RunRow): LedgerEntry {
  const suitePath = safeJsonParse<string[]>(row.suite_path, []);
  const commands = safeJsonParse<CommandResult[]>(row.commands, []);
  const changedFiles = safeJsonParse<string[]>(row.changed_files, []);
  const taskResults = safeJsonParse<TaskResult[]>(row.task_results, []);
  const agentTokenUsage = safeJsonParse<TokenUsage | undefined>(row.agent_token_usage, undefined);
  const judgeTokenUsage = safeJsonParse<TokenUsage | undefined>(row.judge_token_usage, undefined);
  const timing = safeJsonParse<TimingData>(row.timing, { totalMs: row.duration_ms });
  const expectedFiles = safeJsonParse<string[] | undefined>(row.expected_files, undefined);
  const override = safeJsonParse<ScoreOverride | undefined>(row.override, undefined);

  return {
    id: row.id,
    testId: row.test_id,
    suitePath,
    timestamp: row.timestamp,
    variantName: row.variant_name ?? undefined,
    basePrompt: row.base_prompt ?? undefined,
    agentRunner: row.agent_runner,
    instruction: row.instruction,
    diff: row.diff,
    changedFiles,
    commands,
    taskResults,
    agentTokenUsage,
    timing,
    agentOutput: row.agent_output ?? undefined,
    logs: row.logs,
    judgeModel: row.judge_model,
    score: row.score,
    pass: row.pass === 1,
    status: row.status as TestStatus,
    reason: row.reason,
    improvement: row.improvement,
    tags: safeJsonParse<string[]>(row.tags, []),
    judgeTokenUsage,
    criteria: row.criteria,
    expectedFiles,
    thresholds: {
      warn: row.warn_threshold,
      fail: row.fail_threshold,
    },
    durationMs: row.duration_ms,
    override,
  };
}

// ─── Public API ───

/**
 * Append a new run result to the local SQLite ledger.
 */
export function appendLedgerEntry(outputDir: string, entry: LedgerEntry): void {
  const db = openDb(outputDir);
  try {
    const stmt = db.prepare(`
      INSERT INTO runs (
        test_id, suite_path, timestamp, agent_runner, instruction,
        diff, changed_files, commands, task_results,
        agent_token_usage, timing, agent_output, logs,
        judge_model, score, pass, status, reason, improvement, tags,
        judge_token_usage, criteria, expected_files,
        warn_threshold, fail_threshold, duration_ms, override,
        variant_name, base_prompt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      entry.testId,
      JSON.stringify(entry.suitePath ?? []),
      entry.timestamp,
      entry.agentRunner,
      entry.instruction || "",
      entry.diff ?? null,
      JSON.stringify(entry.changedFiles ?? []),
      JSON.stringify(entry.commands ?? []),
      JSON.stringify(entry.taskResults ?? []),
      entry.agentTokenUsage ? JSON.stringify(entry.agentTokenUsage) : null,
      JSON.stringify(entry.timing ?? { totalMs: entry.durationMs }),
      entry.agentOutput ?? null,
      entry.logs ?? "",
      entry.judgeModel,
      entry.score,
      entry.pass ? 1 : 0,
      entry.status,
      entry.reason,
      entry.improvement,
      JSON.stringify(entry.tags ?? []),
      entry.judgeTokenUsage ? JSON.stringify(entry.judgeTokenUsage) : null,
      entry.criteria ?? "",
      entry.expectedFiles ? JSON.stringify(entry.expectedFiles) : null,
      entry.thresholds.warn,
      entry.thresholds.fail,
      entry.durationMs,
      entry.override ? JSON.stringify(entry.override) : null,
      entry.variantName ?? null,
      entry.basePrompt ?? null,
    );
  } finally {
    db.close();
  }
}

/**
 * Read all ledger entries from the SQLite database.
 */
export function readLedger(outputDir: string): LedgerEntry[] {
  if (!existsSync(dbPath(outputDir))) return [];
  const db = openDb(outputDir);
  try {
    const stmt = db.prepare("SELECT * FROM runs ORDER BY timestamp DESC");
    const rows = stmt.all() as RunRow[];
    return rows.map(rowToEntry);
  } finally {
    db.close();
  }
}

/**
 * Get specific stats for runners.
 */
export function getRunnerStats(outputDir: string, testId?: string): RunnerStats[] {
  if (!existsSync(dbPath(outputDir))) return [];
  const db = openDb(outputDir);
  try {
    const query = testId ? "SELECT * FROM runs WHERE test_id = ?" : "SELECT * FROM runs";
    const stmt = db.prepare(query);
    const rows = testId ? (stmt.all(testId) as RunRow[]) : (stmt.all() as RunRow[]);
    const entries = rows.map(rowToEntry);

    const byRunner = new Map<string, { scores: number[]; passes: number }>();
    for (const entry of entries) {
      const key = entry.agentRunner;
      if (!byRunner.has(key)) byRunner.set(key, { scores: [], passes: 0 });
      const bucket = byRunner.get(key)!;

      const effectiveScore = entry.override ? entry.override.score : entry.score;
      const effectivePass = entry.override
        ? computeStatus(entry.override.score, entry.thresholds) !== "FAIL"
        : entry.pass;

      bucket.scores.push(effectiveScore);
      if (effectivePass) bucket.passes++;
    }

    return Array.from(byRunner.entries())
      .map(([agentRunner, data]) => ({
        agentRunner,
        avgScore: data.scores.reduce((a, b) => a + b, 0) / data.scores.length,
        totalRuns: data.scores.length,
        passRate: data.passes / data.scores.length,
      }))
      .sort((a, b) => b.avgScore - a.avgScore);
  } finally {
    db.close();
  }
}

/**
 * Get the hierarchical test tree.
 */
export function getTestTree(outputDir: string): TestTreeNode[] {
  if (!existsSync(dbPath(outputDir))) return [];
  const entries = readLedger(outputDir);
  const seen = new Map<string, string[]>();

  for (const entry of entries) {
    if (!seen.has(entry.testId)) {
      seen.set(entry.testId, entry.suitePath);
    }
  }

  const root: TestTreeNode[] = [];
  for (const [testId, suitePath] of seen) {
    if (suitePath.length === 0) {
      root.push({ name: testId, type: "test", testId });
      continue;
    }
    let current = root;
    for (const suiteName of suitePath) {
      let suiteNode = current.find((n) => n.type === "suite" && n.name === suiteName);
      if (!suiteNode) {
        suiteNode = { name: suiteName, type: "suite", children: [] };
        current.push(suiteNode);
      }
      if (!suiteNode.children) suiteNode.children = [];
      current = suiteNode.children;
    }
    current.push({ name: testId, type: "test", testId });
  }
  return root;
}

/**
 * Get all unique tags.
 */
export function getTags(outputDir: string): string[] {
  if (!existsSync(dbPath(outputDir))) return [];
  const entries = readLedger(outputDir);
  const allTags = new Set<string>();
  for (const entry of entries) {
    if (entry.tags) {
      entry.tags.forEach((t) => allTags.add(t));
    }
  }
  return Array.from(allTags).sort();
}

/**
 * Override a run score.
 */
export function overrideScore(
  outputDir: string,
  runId: number,
  score: number,
  reason: string,
): ScoreOverride {
  const db = openDb(outputDir);
  try {
    const timestamp = new Date().toISOString();
    const override: ScoreOverride = { score, reason, timestamp };
    const stmt = db.prepare("UPDATE runs SET override = ? WHERE id = ?");
    stmt.run(JSON.stringify(override), runId);
    return override;
  } finally {
    db.close();
  }
}
