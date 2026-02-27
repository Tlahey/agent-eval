# Ledger

The ledger stores all evaluation results in `.agenteval/ledger.sqlite` (SQLite via Node 22's `node:sqlite`).

## Storage

Results are persisted in a `runs` SQLite table. The database location is configurable:

| Priority | Method              | Example                            |
| -------- | ------------------- | ---------------------------------- |
| 1        | CLI `--output` flag | `agenteval ledger -o ./my-results` |
| 2        | Config `outputDir`  | `outputDir: "./custom-output"`     |
| 3        | Default             | `.agenteval/ledger.sqlite`         |

## Entry Schema

Each ledger entry contains:

```json
{
  "testId": "Add a Close button to the Banner",
  "timestamp": "2025-03-15T10:30:00.000Z",
  "agentRunner": "copilot",
  "judgeModel": "claude-sonnet-4-20250514",
  "score": 0.85,
  "pass": true,
  "reason": "The agent correctly added...",
  "context": {
    "diff": "diff --git a/...",
    "commands": [...]
  },
  "durationMs": 45000
}
```

## Reading the Ledger

### CLI

```bash
# Summary view (last 20 entries)
agenteval ledger

# Full JSON export
agenteval ledger --json

# Read from a specific directory
agenteval ledger -o ./my-results
```

### Dashboard API

Launch the dashboard server to explore results via HTTP:

```bash
agenteval view           # default port 4747
agenteval ui -p 8080     # custom port
```

| Endpoint         | Description                          |
| ---------------- | ------------------------------------ |
| `GET /api/runs`  | All runs (filter with `?testId=...`) |
| `GET /api/tests` | List of unique test IDs              |
| `GET /api/stats` | Aggregate stats per runner per test  |

### Programmatic

```ts
import { readLedger, readLedgerByTestId, getLatestEntries } from "agent-eval/ledger";

const allEntries = readLedger(".agenteval");
const bannerEntries = readLedgerByTestId(".agenteval", "Add Close button");
const latest = getLatestEntries(".agenteval");
```

## SQLite Schema

| Column         | Type      | Description                  |
| -------------- | --------- | ---------------------------- |
| `id`           | `INTEGER` | Auto-increment primary key   |
| `test_id`      | `TEXT`    | Test title                   |
| `timestamp`    | `TEXT`    | ISO 8601 timestamp           |
| `agent_runner` | `TEXT`    | Runner name                  |
| `judge_model`  | `TEXT`    | Judge model used             |
| `score`        | `REAL`    | 0.0 to 1.0                   |
| `pass`         | `INTEGER` | 1 = passed, 0 = failed       |
| `reason`       | `TEXT`    | Judge's markdown explanation |
| `diff`         | `TEXT`    | Raw git diff                 |
| `commands`     | `TEXT`    | JSON-encoded command results |
| `duration_ms`  | `INTEGER` | Total duration in ms         |

Indexes on `test_id` and `timestamp` for fast queries.
