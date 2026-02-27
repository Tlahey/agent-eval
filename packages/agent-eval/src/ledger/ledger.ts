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
      timestamp    TEXT    NOT NULL,
      agent_runner TEXT    NOT NULL,
      judge_model  TEXT    NOT NULL,
      score        REAL    NOT NULL,
      pass         INTEGER NOT NULL,
      reason       TEXT    NOT NULL,
      diff         TEXT,
      commands     TEXT,
      duration_ms  INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_runs_test_id   ON runs(test_id);
    CREATE INDEX IF NOT EXISTS idx_runs_timestamp  ON runs(timestamp);
  `);

  return db;
}

// ─── Row ↔ LedgerEntry mapping ───

interface RunRow {
  id: number;
  test_id: string;
  timestamp: string;
  agent_runner: string;
  judge_model: string;
  score: number;
  pass: number;
  reason: string;
  diff: string | null;
  commands: string | null;
  duration_ms: number;
}

function rowToEntry(row: RunRow): LedgerEntry {
  return {
    testId: row.test_id,
    timestamp: row.timestamp,
    agentRunner: row.agent_runner,
    judgeModel: row.judge_model,
    score: row.score,
    pass: row.pass === 1,
    reason: row.reason,
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
      INSERT INTO runs (test_id, timestamp, agent_runner, judge_model, score, pass, reason, diff, commands, duration_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      entry.testId,
      entry.timestamp,
      entry.agentRunner,
      entry.judgeModel,
      entry.score,
      entry.pass ? 1 : 0,
      entry.reason,
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
