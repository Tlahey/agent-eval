import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { LedgerEntry, CommandResult } from "../core/types.js";

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
  reason: string;
  improvement: string;
  diff: string | null;
  commands: string | null;
  duration_ms: number;
}

function rowToEntry(row: RunRow): LedgerEntry {
  let suitePath: string[];
  try {
    suitePath = JSON.parse(row.suite_path) as string[];
  } catch {
    suitePath = [];
  }
  return {
    id: row.id,
    testId: row.test_id,
    suitePath,
    timestamp: row.timestamp,
    agentRunner: row.agent_runner,
    judgeModel: row.judge_model,
    score: row.score,
    pass: row.pass === 1,
    reason: row.reason,
    improvement: row.improvement ?? "",
    context: {
      diff: row.diff,
      commands: row.commands ? (JSON.parse(row.commands) as CommandResult[]) : [],
    },
    durationMs: row.duration_ms,
  };
}

/**
 * Append a single entry to the SQLite ledger.
 */
export function appendLedgerEntry(outputDir: string, entry: LedgerEntry): void {
  const db = openDb(outputDir);
  try {
    const stmt = db.prepare(`
      INSERT INTO runs (test_id, suite_path, timestamp, agent_runner, judge_model, score, pass, reason, improvement, diff, commands, duration_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      entry.testId,
      JSON.stringify(entry.suitePath ?? []),
      entry.timestamp,
      entry.agentRunner,
      entry.judgeModel,
      entry.score,
      entry.pass ? 1 : 0,
      entry.reason,
      entry.improvement,
      entry.context.diff,
      JSON.stringify(entry.context.commands),
      entry.durationMs,
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
      .prepare("SELECT * FROM runs ORDER BY timestamp ASC")
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
      .prepare("SELECT * FROM runs WHERE test_id = ? ORDER BY timestamp ASC")
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
    // Use a subquery to find the max timestamp per test_id, then join back
    const rows = db
      .prepare(
        `
        SELECT r.* FROM runs r
        INNER JOIN (
          SELECT test_id, MAX(timestamp) AS max_ts
          FROM runs
          GROUP BY test_id
        ) latest ON r.test_id = latest.test_id AND r.timestamp = latest.max_ts
        ORDER BY r.test_id
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
          agent_runner,
          AVG(score) AS avg_score,
          COUNT(*) AS total_runs,
          (SUM(pass) * 1.0 / COUNT(*)) AS pass_rate
        FROM runs
        WHERE test_id = ?
        GROUP BY agent_runner
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
          agent_runner,
          AVG(score) AS avg_score,
          COUNT(*) AS total_runs,
          (SUM(pass) * 1.0 / COUNT(*)) AS pass_rate
        FROM runs
        GROUP BY agent_runner
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
