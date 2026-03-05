import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  LedgerEntry,
  CommandResult,
  ScoreOverride,
  TestStatus,
  Thresholds,
  TokenUsage,
  TaskResult,
  TimingData,
} from "../core/types.js";
import { computeStatus, DEFAULT_THRESHOLDS } from "../core/types.js";

/**
 * Resolve the SQLite database path.
 */
function dbPath(outputDir: string): string {
  return join(outputDir, "ledger.sqlite");
}

/**
 * Open (or create) the ledger database and ensure the schema exists.
 */
function openDb(outputDir: string): InstanceType<typeof DatabaseSync> {
  mkdirSync(outputDir, { recursive: true });
  const db = new DatabaseSync(dbPath(outputDir));

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
      judge_token_usage   TEXT,
      criteria            TEXT    NOT NULL DEFAULT '',
      expected_files      TEXT,
      warn_threshold      REAL    NOT NULL DEFAULT 0.8,
      fail_threshold      REAL    NOT NULL DEFAULT 0.5,
      duration_ms         INTEGER NOT NULL,
      override            TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_runs_test_id   ON runs(test_id);
    CREATE INDEX IF NOT EXISTS idx_runs_timestamp  ON runs(timestamp);
  `);

  // ─── Simple Migrations ───
  // Ensure new columns exist for existing databases
  const columns = ["improvement", "task_results", "override", "suite_path", "instruction"];
  for (const col of columns) {
    try {
      db.exec(`ALTER TABLE runs ADD COLUMN ${col} TEXT`);
    } catch {
      // Column already exists, ignore
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
  commands: string | null;
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
  judge_token_usage: string | null;
  criteria: string;
  expected_files: string | null;
  warn_threshold: number;
  fail_threshold: number;
  duration_ms: number;
  override: string | null;
}

/** SQL fragment that selects runs */
const SELECT_RUNS = `
  SELECT * FROM runs
`;

function rowToEntry(row: RunRow): LedgerEntry {
  let suitePath: string[];
  try {
    suitePath = JSON.parse(row.suite_path) as string[];
  } catch {
    suitePath = [];
  }
  const thresholds: Thresholds = {
    warn: row.warn_threshold ?? DEFAULT_THRESHOLDS.warn,
    fail: row.fail_threshold ?? DEFAULT_THRESHOLDS.fail,
  };
  const status =
    row.status === "PASS" || row.status === "WARN" || row.status === "FAIL"
      ? (row.status as TestStatus)
      : computeStatus(row.score, thresholds);
  const commands = row.commands ? (JSON.parse(row.commands) as CommandResult[]) : [];
  const changedFiles = safeJsonParse<string[]>(row.changed_files, []);
  const taskResults = safeJsonParse<TaskResult[]>(row.task_results, []);
  const agentTokenUsage = safeJsonParse<TokenUsage | undefined>(row.agent_token_usage, undefined);
  const judgeTokenUsage = safeJsonParse<TokenUsage | undefined>(row.judge_token_usage, undefined);
  const timing = safeJsonParse<TimingData>(row.timing, { totalMs: row.duration_ms });
  const expectedFiles = safeJsonParse<string[] | undefined>(row.expected_files, undefined);
  const override = safeJsonParse<ScoreOverride | undefined>(row.override, undefined);

  const entry: LedgerEntry = {
    id: row.id,
    testId: row.test_id,
    suitePath,
    timestamp: row.timestamp,
    // Execution data
    agentRunner: row.agent_runner,
    instruction: row.instruction ?? "",
    diff: row.diff,
    changedFiles,
    commands,
    taskResults,
    agentTokenUsage,
    timing,
    agentOutput: row.agent_output ?? undefined,
    logs: row.logs ?? "",
    // Judgment data
    judgeModel: row.judge_model,
    score: row.score,
    pass: row.pass === 1,
    status,
    reason: row.reason,
    improvement: row.improvement ?? "",
    judgeTokenUsage,
    criteria: row.criteria ?? "",
    expectedFiles,
    thresholds,
    durationMs: row.duration_ms,
    override,
  };
  return entry;
}

function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/**
 * Append a single entry to the SQLite ledger.
 */
export function appendLedgerEntry(outputDir: string, entry: LedgerEntry): void {
  const db = openDb(outputDir);
  try {
    const stmt = db.prepare(`
      INSERT INTO runs (
        test_id, suite_path, timestamp, agent_runner, instruction,
        diff, changed_files, commands, task_results,
        agent_token_usage, timing, agent_output, logs,
        judge_model, score, pass, status, reason, improvement,
        judge_token_usage, criteria, expected_files,
        warn_threshold, fail_threshold, duration_ms, override
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      entry.testId,
      JSON.stringify(entry.suitePath ?? []),
      entry.timestamp,
      entry.agentRunner,
      entry.instruction ?? "",
      entry.diff,
      JSON.stringify(entry.changedFiles ?? []),
      JSON.stringify(entry.commands),
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
      entry.judgeTokenUsage ? JSON.stringify(entry.judgeTokenUsage) : null,
      entry.criteria ?? "",
      entry.expectedFiles ? JSON.stringify(entry.expectedFiles) : null,
      entry.thresholds.warn,
      entry.thresholds.fail,
      entry.durationMs,
      entry.override ? JSON.stringify(entry.override) : null,
    );
  } finally {
    db.close();
  }
}

/**
 * Read all ledger entries from the SQLite database.
 */
export function readLedger(outputDir: string): LedgerEntry[] {
  const db = openDb(outputDir);
  try {
    const rows = db.prepare(`${SELECT_RUNS} ORDER BY timestamp ASC`).all() as unknown as RunRow[];
    return rows.map(rowToEntry);
  } finally {
    db.close();
  }
}

/**
 * Read ledger entries for a specific test ID.
 */
export function readLedgerByTestId(outputDir: string, testId: string): LedgerEntry[] {
  const db = openDb(outputDir);
  try {
    const rows = db
      .prepare(`${SELECT_RUNS} WHERE test_id = ? ORDER BY timestamp ASC`)
      .all(testId) as unknown as RunRow[];
    return rows.map(rowToEntry);
  } finally {
    db.close();
  }
}

/**
 * Get unique test IDs from the ledger.
 */
export function getTestIds(outputDir: string): string[] {
  const db = openDb(outputDir);
  try {
    const rows = db
      .prepare("SELECT DISTINCT test_id FROM runs ORDER BY test_id")
      .all() as unknown as Array<{
      test_id: string;
    }>;
    return rows.map((r) => r.test_id);
  } finally {
    db.close();
  }
}

/** A tree node representing a suite or test in the hierarchy */
export interface TestTreeNode {
  name: string;
  type: "suite" | "test";
  testId?: string;
  children?: TestTreeNode[];
}

/**
 * Get hierarchical test tree from the ledger.
 * Groups tests by their suite_path into a tree structure.
 */
export function getTestTree(outputDir: string): TestTreeNode[] {
  const db = openDb(outputDir);
  try {
    const rows = db
      .prepare("SELECT DISTINCT test_id, suite_path FROM runs ORDER BY test_id")
      .all() as unknown as Array<{ test_id: string; suite_path: string }>;

    const root: TestTreeNode[] = [];

    for (const row of rows) {
      let suitePath: string[];
      try {
        suitePath = JSON.parse(row.suite_path) as string[];
      } catch {
        suitePath = [];
      }

      if (suitePath.length === 0) {
        // Top-level test (no suite)
        root.push({ name: row.test_id, type: "test", testId: row.test_id });
        continue;
      }

      // Navigate into the tree, creating suite nodes as needed
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
      current.push({ name: row.test_id, type: "test", testId: row.test_id });
    }

    return root;
  } finally {
    db.close();
  }
}

/**
 * Get the latest entry for each test ID.
 */
export function getLatestEntries(outputDir: string): Map<string, LedgerEntry> {
  const db = openDb(outputDir);
  try {
    const rows = db
      .prepare(
        `
        SELECT rr.*
        FROM runs rr
        INNER JOIN (
          SELECT test_id, MAX(timestamp) AS max_ts
          FROM runs
          GROUP BY test_id
        ) latest ON rr.test_id = latest.test_id AND rr.timestamp = latest.max_ts
        ORDER BY rr.test_id
      `,
      )
      .all() as unknown as RunRow[];

    const result = new Map<string, LedgerEntry>();
    for (const row of rows) {
      result.set(row.test_id, rowToEntry(row));
    }
    return result;
  } finally {
    db.close();
  }
}

/**
 * Get aggregate stats per runner for a given test ID.
 * Useful for dashboard trend charts.
 */
export function getRunnerStats(
  outputDir: string,
  testId: string,
): Array<{ agentRunner: string; avgScore: number; totalRuns: number; passRate: number }> {
  const db = openDb(outputDir);
  try {
    const runs = readLedgerByTestId(outputDir, testId);
    return computeAggregateStats(runs);
  } finally {
    db.close();
  }
}

/**
 * Get aggregate stats per runner across ALL tests.
 */
export function getAllRunnerStats(
  outputDir: string,
): Array<{ agentRunner: string; avgScore: number; totalRuns: number; passRate: number }> {
  const db = openDb(outputDir);
  try {
    const runs = readLedger(outputDir);
    return computeAggregateStats(runs);
  } finally {
    db.close();
  }
}

function computeAggregateStats(
  runs: LedgerEntry[],
): Array<{ agentRunner: string; avgScore: number; totalRuns: number; passRate: number }> {
  const byRunner = new Map<string, { scores: number[]; passes: number }>();
  for (const run of runs) {
    const key = run.agentRunner;
    if (!byRunner.has(key)) byRunner.set(key, { scores: [], passes: 0 });
    const bucket = byRunner.get(key)!;
    const score = run.override ? run.override.score : run.score;
    const pass = run.override ? run.override.pass : run.pass;
    bucket.scores.push(score);
    if (pass) bucket.passes++;
  }
  return [...byRunner.entries()]
    .map(([agentRunner, { scores, passes }]) => ({
      agentRunner,
      avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
      totalRuns: scores.length,
      passRate: passes / scores.length,
    }))
    .sort((a, b) => b.avgScore - a.avgScore);
}

// ─── Score Overrides (HITL) ───

/**
 * Override the score for a given run.
 */
export function overrideRunScore(
  outputDir: string,
  runId: number,
  newScore: number,
  reason: string,
): ScoreOverride {
  if (newScore < 0 || newScore > 1) throw new Error("Score must be between 0 and 1");
  if (!reason.trim()) throw new Error("Reason is required");

  const db = openDb(outputDir);
  try {
    // Get the run to read its thresholds
    const row = db
      .prepare("SELECT warn_threshold, fail_threshold FROM runs WHERE id = ?")
      .get(runId) as { warn_threshold: number; fail_threshold: number } | undefined;
    if (!row) throw new Error(`Run #${runId} not found`);

    const thresholds: Thresholds = {
      warn: row.warn_threshold ?? DEFAULT_THRESHOLDS.warn,
      fail: row.fail_threshold ?? DEFAULT_THRESHOLDS.fail,
    };
    const timestamp = new Date().toISOString();
    const status = computeStatus(newScore, thresholds);
    const pass = status !== "FAIL";

    const override: ScoreOverride = {
      score: newScore,
      pass,
      status,
      reason: reason.trim(),
      timestamp,
    };

    db.prepare(`UPDATE runs SET override = ? WHERE id = ?`).run(JSON.stringify(override), runId);

    return override;
  } finally {
    db.close();
  }
}

/**
 * Get all score overrides for a given run (audit trail).
 * Since we now only keep the latest, this returns a list of 1 or 0.
 */
export function getRunOverrides(outputDir: string, runId: number): ScoreOverride[] {
  const db = openDb(outputDir);
  try {
    const row = db.prepare(`SELECT override FROM runs WHERE id = ?`).get(runId) as
      | { override: string | null }
      | undefined;
    if (!row || !row.override) return [];
    return [JSON.parse(row.override)];
  } finally {
    db.close();
  }
}
