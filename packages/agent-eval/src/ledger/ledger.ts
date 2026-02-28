import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  LedgerEntry,
  CommandResult,
  ScoreOverride,
  TestStatus,
  Thresholds,
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
    CREATE INDEX IF NOT EXISTS idx_runs_test_id   ON runs(test_id);
    CREATE INDEX IF NOT EXISTS idx_runs_timestamp  ON runs(timestamp);
  `);

  // Migrate: add improvement column if missing (backward compat with older DBs)
  try {
    db.exec(`ALTER TABLE runs ADD COLUMN improvement TEXT NOT NULL DEFAULT ''`);
  } catch {
    // Column already exists — ignore
  }

  // Migrate: add suite_path column if missing (backward compat with older DBs)
  try {
    db.exec(`ALTER TABLE runs ADD COLUMN suite_path TEXT NOT NULL DEFAULT '[]'`);
  } catch {
    // Column already exists — ignore
  }

  // Migrate: add status column if missing
  try {
    db.exec(`ALTER TABLE runs ADD COLUMN status TEXT NOT NULL DEFAULT 'FAIL'`);
  } catch {
    // Column already exists — ignore
  }

  // Migrate: add threshold columns if missing
  try {
    db.exec(`ALTER TABLE runs ADD COLUMN warn_threshold REAL NOT NULL DEFAULT 0.8`);
  } catch {
    // Column already exists — ignore
  }
  try {
    db.exec(`ALTER TABLE runs ADD COLUMN fail_threshold REAL NOT NULL DEFAULT 0.5`);
  } catch {
    // Column already exists — ignore
  }

  // Score overrides table (HITL — human-in-the-loop)
  db.exec(`
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

  // Migrate: add status to score_overrides if missing
  try {
    db.exec(`ALTER TABLE score_overrides ADD COLUMN status TEXT NOT NULL DEFAULT 'FAIL'`);
  } catch {
    // Column already exists — ignore
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
  judge_model: string;
  score: number;
  pass: number;
  status: string;
  reason: string;
  improvement: string;
  diff: string | null;
  commands: string | null;
  duration_ms: number;
  warn_threshold: number;
  fail_threshold: number;
  /* Override columns (nullable, from LEFT JOIN) */
  override_score: number | null;
  override_pass: number | null;
  override_status: string | null;
  override_reason: string | null;
  override_timestamp: string | null;
}

/** SQL fragment that selects runs with their latest override */
const RUNS_WITH_OVERRIDE = `
  SELECT r.*,
         o.score     AS override_score,
         o.pass      AS override_pass,
         o.status    AS override_status,
         o.reason    AS override_reason,
         o.timestamp AS override_timestamp
  FROM runs r
  LEFT JOIN (
    SELECT run_id, score, pass, status, reason, timestamp,
           ROW_NUMBER() OVER (PARTITION BY run_id ORDER BY id DESC) AS rn
    FROM score_overrides
  ) o ON o.run_id = r.id AND o.rn = 1
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
  // Backward compat: if status is missing or default, recompute from score
  const status =
    row.status === "PASS" || row.status === "WARN" || row.status === "FAIL"
      ? (row.status as TestStatus)
      : computeStatus(row.score, thresholds);
  const entry: LedgerEntry = {
    id: row.id,
    testId: row.test_id,
    suitePath,
    timestamp: row.timestamp,
    agentRunner: row.agent_runner,
    judgeModel: row.judge_model,
    score: row.score,
    pass: row.pass === 1,
    status,
    reason: row.reason,
    improvement: row.improvement ?? "",
    context: {
      diff: row.diff,
      commands: row.commands ? (JSON.parse(row.commands) as CommandResult[]) : [],
    },
    durationMs: row.duration_ms,
    thresholds,
  };
  if (row.override_score != null) {
    const overrideStatus =
      row.override_status === "PASS" ||
      row.override_status === "WARN" ||
      row.override_status === "FAIL"
        ? (row.override_status as TestStatus)
        : computeStatus(row.override_score, thresholds);
    entry.override = {
      score: row.override_score,
      pass: row.override_pass === 1,
      status: overrideStatus,
      reason: row.override_reason ?? "",
      timestamp: row.override_timestamp ?? "",
    };
  }
  return entry;
}

/**
 * Append a single entry to the SQLite ledger.
 */
export function appendLedgerEntry(outputDir: string, entry: LedgerEntry): void {
  const db = openDb(outputDir);
  try {
    const stmt = db.prepare(`
      INSERT INTO runs (test_id, suite_path, timestamp, agent_runner, judge_model, score, pass, status, reason, improvement, diff, commands, duration_ms, warn_threshold, fail_threshold)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      entry.testId,
      JSON.stringify(entry.suitePath ?? []),
      entry.timestamp,
      entry.agentRunner,
      entry.judgeModel,
      entry.score,
      entry.pass ? 1 : 0,
      entry.status,
      entry.reason,
      entry.improvement,
      entry.context.diff,
      JSON.stringify(entry.context.commands),
      entry.durationMs,
      entry.thresholds.warn,
      entry.thresholds.fail,
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
    const rows = db
      .prepare(`${RUNS_WITH_OVERRIDE} ORDER BY r.timestamp ASC`)
      .all() as unknown as RunRow[];
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
      .prepare(`${RUNS_WITH_OVERRIDE} WHERE r.test_id = ? ORDER BY r.timestamp ASC`)
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
        SELECT rr.*, o.score AS override_score, o.pass AS override_pass,
               o.reason AS override_reason, o.timestamp AS override_timestamp
        FROM runs rr
        INNER JOIN (
          SELECT test_id, MAX(timestamp) AS max_ts
          FROM runs
          GROUP BY test_id
        ) latest ON rr.test_id = latest.test_id AND rr.timestamp = latest.max_ts
        LEFT JOIN (
          SELECT run_id, score, pass, reason, timestamp,
                 ROW_NUMBER() OVER (PARTITION BY run_id ORDER BY id DESC) AS rn
          FROM score_overrides
        ) o ON o.run_id = rr.id AND o.rn = 1
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
    const rows = db
      .prepare(
        `
        SELECT
          r.agent_runner,
          AVG(COALESCE(o.score, r.score)) AS avg_score,
          COUNT(*) AS total_runs,
          (SUM(COALESCE(o.pass, r.pass)) * 1.0 / COUNT(*)) AS pass_rate
        FROM runs r
        LEFT JOIN (
          SELECT run_id, score, pass,
                 ROW_NUMBER() OVER (PARTITION BY run_id ORDER BY id DESC) AS rn
          FROM score_overrides
        ) o ON o.run_id = r.id AND o.rn = 1
        WHERE r.test_id = ?
        GROUP BY r.agent_runner
        ORDER BY avg_score DESC
      `,
      )
      .all(testId) as unknown as Array<{
      agent_runner: string;
      avg_score: number;
      total_runs: number;
      pass_rate: number;
    }>;
    return rows.map((r) => ({
      agentRunner: r.agent_runner,
      avgScore: r.avg_score,
      totalRuns: r.total_runs,
      passRate: r.pass_rate,
    }));
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
    const rows = db
      .prepare(
        `
        SELECT
          r.agent_runner,
          AVG(COALESCE(o.score, r.score)) AS avg_score,
          COUNT(*) AS total_runs,
          (SUM(COALESCE(o.pass, r.pass)) * 1.0 / COUNT(*)) AS pass_rate
        FROM runs r
        LEFT JOIN (
          SELECT run_id, score, pass,
                 ROW_NUMBER() OVER (PARTITION BY run_id ORDER BY id DESC) AS rn
          FROM score_overrides
        ) o ON o.run_id = r.id AND o.rn = 1
        GROUP BY r.agent_runner
        ORDER BY avg_score DESC
      `,
      )
      .all() as unknown as Array<{
      agent_runner: string;
      avg_score: number;
      total_runs: number;
      pass_rate: number;
    }>;
    return rows.map((r) => ({
      agentRunner: r.agent_runner,
      avgScore: r.avg_score,
      totalRuns: r.total_runs,
      passRate: r.pass_rate,
    }));
  } finally {
    db.close();
  }
}

// ─── Score Overrides (HITL) ───

/**
 * Override the score for a given run.
 * Adds a new row to score_overrides (audit trail is preserved).
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
    const run = db
      .prepare("SELECT id, warn_threshold, fail_threshold FROM runs WHERE id = ?")
      .get(runId) as { id: number; warn_threshold: number; fail_threshold: number } | undefined;
    if (!run) throw new Error(`Run #${runId} not found`);

    const thresholds: Thresholds = {
      warn: run.warn_threshold ?? DEFAULT_THRESHOLDS.warn,
      fail: run.fail_threshold ?? DEFAULT_THRESHOLDS.fail,
    };
    const timestamp = new Date().toISOString();
    const status = computeStatus(newScore, thresholds);
    const pass = status !== "FAIL" ? 1 : 0;

    db.prepare(
      `INSERT INTO score_overrides (run_id, score, pass, status, reason, timestamp) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(runId, newScore, pass, status, reason.trim(), timestamp);

    return { score: newScore, pass: pass === 1, status, reason: reason.trim(), timestamp };
  } finally {
    db.close();
  }
}

/**
 * Get all score overrides for a given run (audit trail).
 * Ordered from newest to oldest.
 */
export function getRunOverrides(outputDir: string, runId: number): ScoreOverride[] {
  const db = openDb(outputDir);
  try {
    const rows = db
      .prepare(
        `SELECT score, pass, status, reason, timestamp FROM score_overrides WHERE run_id = ? ORDER BY id DESC`,
      )
      .all(runId) as unknown as Array<{
      score: number;
      pass: number;
      status: string;
      reason: string;
      timestamp: string;
    }>;
    return rows.map((r) => ({
      score: r.score,
      pass: r.pass === 1,
      status: (r.status as TestStatus) ?? (r.pass === 1 ? "PASS" : "FAIL"),
      reason: r.reason,
      timestamp: r.timestamp,
    }));
  } finally {
    db.close();
  }
}
