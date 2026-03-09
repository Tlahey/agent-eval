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

Each ledger entry captures the complete lifecycle of a test run — **execution data** (what the agent did) and **judgment data** (how the judge evaluated):

```json
{
  "id": 1,
  "testId": "Add a Close button to the Banner",
  "suitePath": ["UI Components", "Banner"],
  "timestamp": "2025-03-15T10:30:00.000Z",
  "variantId": "with-skills",
  "variantName": "GPT-4o with UI Skills",
  "basePrompt": "Add a close button to the Banner component",
  "agentRunner": "gpt4o",

  "instruction": "Acting as a senior dev... Add a close button...",
  "diff": "diff --git a/...",
  "changedFiles": ["src/components/Banner.tsx"],
  "commands": [
    {
      "name": "test",
      "command": "pnpm test",
      "stdout": "...",
      "stderr": "",
      "exitCode": 0,
      "durationMs": 3200
    }
  ],
  "taskResults": [
    {
      "task": { "name": "Build", "criteria": "Build succeeds", "weight": 2 },
      "result": {
        "name": "Build",
        "command": "pnpm build",
        "stdout": "...",
        "stderr": "",
        "exitCode": 0,
        "durationMs": 1500
      }
    }
  ],
  "agentTokenUsage": { "inputTokens": 1200, "outputTokens": 800, "totalTokens": 2000 },
  "timing": {
    "totalMs": 45000,
    "setupMs": 200,
    "agentMs": 40000,
    "tasksMs": 1500,
    "judgeMs": 3200
  },
  "agentOutput": "I'll add a close button...",
  "logs": "## Diff\n...\n## Commands\n...",
  "durationMs": 45000,

  "judgeModel": "claude-sonnet-4-20250514",
  "score": 0.85,
  "pass": true,
  "status": "PASS",
  "reason": "The agent correctly added a close button with proper aria-label...",
  "improvement": "Consider adding keyboard event handling for Escape key",
  "judgeTokenUsage": { "inputTokens": 2500, "outputTokens": 600, "totalTokens": 3100 },
  "criteria": "Close button with aria-label, click handler, no TS errors",
  "expectedFiles": ["src/components/Banner.tsx"],
  "thresholds": { "warn": 0.8, "fail": 0.5 }
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
agenteval ui             # default port 4747
agenteval ui -p 8080     # custom port
```

| Endpoint                  | Method  | Description                             |
| ------------------------- | ------- | --------------------------------------- |
| `/api/runs`               | `GET`   | All runs (filter with `?testId=...`)    |
| `/api/tests`              | `GET`   | List of unique test IDs                 |
| `/api/tree`               | `GET`   | Hierarchical test tree (suites + tests) |
| `/api/stats`              | `GET`   | Aggregate stats per runner per test     |
| `/api/runs/:id/override`  | `PATCH` | Override a run's score (HITL)           |
| `/api/runs/:id/overrides` | `GET`   | Audit trail of overrides for a run      |

See the [Dashboard guide](/guide/dashboard) for details on the web UI.

### Programmatic

```ts
import { readLedger, readLedgerByTestId, getLatestEntries } from "@tlahey/agent-eval/ledger";

const allEntries = readLedger(".agenteval");
const latest = getLatestEntries(".agenteval");
```

## SQLite Schema

```mermaid
erDiagram
    RUNS {
        int id PK "auto-increment"
        text test_id "indexed"
        text suite_path "JSON array"
        text timestamp "indexed, ISO 8601"
        text variant_id "experiment variant ID"
        text variant_name "display name"
        text base_prompt "common mission prompt"
        text agent_runner "runner ID"
        text instruction "final prompt sent to LLM"
        text diff "raw git diff"
        text changed_files "JSON: string[]"
        text commands "JSON: CommandResult[]"
        text task_results "JSON: TaskResult[]"
        text agent_token_usage "JSON: TokenUsage"
        text timing "JSON: TimingData"
        text agent_output "raw agent output"
        text logs "formatted log string"
        int duration_ms "agent run time"
        text judge_model "LLM model used"
        real score "0.0 – 1.0"
        int pass "0 or 1"
        text status "PASS, WARN, or FAIL"
        text reason "judge explanation"
        text improvement "judge suggestions"
        text judge_token_usage "JSON: TokenUsage"
        text criteria "evaluation criteria"
        text expected_files "JSON: string[]"
        text thresholds "JSON: Thresholds"
    }
    SCORE_OVERRIDES {
        int id PK "auto-increment"
        int run_id FK "references runs.id"
        real score "0.0 – 1.0"
        int pass "0 or 1"
        text status "PASS, WARN, or FAIL"
        text reason "human explanation"
        text timestamp "ISO 8601"
    }
    RUNS ||--o{ SCORE_OVERRIDES : "has overrides"
```

### `runs` Table — Identity & Experiment

| Column         | Type   | Description                                   |
| -------------- | ------ | --------------------------------------------- |
| `id`           | `INT`  | Auto-increment primary key                    |
| `test_id`      | `TEXT` | Test title (indexed)                          |
| `suite_path`   | `TEXT` | JSON array of suite names                     |
| `timestamp`    | `TEXT` | ISO 8601 timestamp (indexed)                  |
| `variant_id`   | `TEXT` | Variant ID from test.variants()               |
| `variant_name` | `TEXT` | Human-readable variant name                   |
| `base_prompt`  | `TEXT` | The original mission prompt (before template) |
| `agent_runner` | `TEXT` | Global Runner ID used                         |

### `runs` Table — Execution Data

| Column              | Type      | Description                                     |
| ------------------- | --------- | ----------------------------------------------- |
| `instruction`       | `TEXT`    | Final prompt sent to the LLM (with template)    |
| `diff`              | `TEXT`    | Raw git diff                                    |
| `changed_files`     | `TEXT`    | JSON-encoded string array of changed file paths |
| `commands`          | `TEXT`    | JSON-encoded `CommandResult[]`                  |
| `task_results`      | `TEXT`    | JSON-encoded `TaskResult[]`                     |
| `agent_token_usage` | `TEXT`    | JSON-encoded `TokenUsage`                       |
| `timing`            | `TEXT`    | JSON-encoded `TimingData`                       |
| `agent_output`      | `TEXT`    | Raw agent output text                           |
| `duration_ms`       | `INTEGER` | Total duration in ms                            |

### `runs` Table — Judgment Data

| Column              | Type      | Description                                       |
| ------------------- | --------- | ------------------------------------------------- |
| `judge_model`       | `TEXT`    | Judge model used                                  |
| `score`             | `REAL`    | 0.0 to 1.0                                        |
| `pass`              | `INTEGER` | 1 = passed, 0 = failed                            |
| `status`            | `TEXT`    | `PASS`, `WARN`, or `FAIL`                         |
| `reason`            | `TEXT`    | Judge's markdown explanation                      |
| `improvement`       | `TEXT`    | Judge's improvement suggestions                   |
| `judge_token_usage` | `TEXT`    | JSON-encoded `TokenUsage` (judge LLM usage)       |
| `criteria`          | `TEXT`    | Evaluation criteria used                          |
| `expected_files`    | `TEXT`    | JSON-encoded expected file list                   |
| `thresholds`        | `TEXT`    | JSON-encoded thresholds `{ warn, fail }` snapshot |
