# ADR-002: SQLite over JSONL for the Ledger

**Status:** Accepted  
**Date:** 2026-02-27  
**Context:** The evaluation ledger stores test runs with large payloads (Git diffs, terminal logs, LLM reasoning). We need efficient storage, querying, and dashboard rendering.

## Decision

Use Node 22's **native `node:sqlite`** (`DatabaseSync`) instead of a JSONL flat file.

## Rationale

### Why not JSONL?
- Storing hundreds of full Git diffs and terminal logs **quickly bloats flat files**
- Querying (filter by test ID, group by model, sort by date) requires **reading the entire file** into memory
- No indexing, no `GROUP BY`, no aggregations — the dashboard would need to do all computation client-side
- Concurrent writes risk corruption without file-level locking

### Why native `node:sqlite`?
- Node 22 ships `node:sqlite` **built-in** — zero external npm dependencies
- `DatabaseSync` provides a synchronous API perfect for our sequential execution model
- **SQL queries** enable instant dashboard rendering: `SELECT testId, AVG(score) GROUP BY agentRunner`
- B-tree indexes on `testId` and `timestamp` make lookups O(log n)
- The `.sqlite` file is a single portable binary — easy to backup, share, or inspect with any SQLite client
- WAL mode enables concurrent reads (dashboard) while the runner writes

### Why not PostgreSQL / MongoDB / etc.?
- External database servers add operational complexity
- We want **zero-config, zero-dependency** local evaluation
- SQLite is the world's most deployed database — it's the right tool for local analytics

## Schema

```sql
CREATE TABLE IF NOT EXISTS runs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  test_id     TEXT NOT NULL,
  timestamp   TEXT NOT NULL,
  agent_runner TEXT NOT NULL,
  judge_model TEXT NOT NULL,
  score       REAL NOT NULL,
  pass        INTEGER NOT NULL,
  reason      TEXT NOT NULL,
  diff        TEXT,
  commands    TEXT,  -- JSON array of CommandResult
  duration_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_runs_test_id ON runs(test_id);
CREATE INDEX IF NOT EXISTS idx_runs_timestamp ON runs(timestamp);
```

## Consequences

- Requires Node >= 22.5.0 (first stable `node:sqlite`)
- The ledger is no longer human-readable in a text editor (use `sqlite3` CLI or the dashboard)
- Migration path from JSONL: one-time import script (read JSONL, insert into SQLite)
- Dashboard queries become trivial SQL instead of in-memory array processing
