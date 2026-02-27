# Ledger

The ledger stores all evaluation results in `.agenteval/ledger.jsonl`.

## Format

Each line is a JSON object:

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
agenteval ledger        # Summary view
agenteval ledger --json # Full JSON export
```

### Programmatic

```ts
import { readLedger, readLedgerByTestId, getLatestEntries } from "agent-eval/ledger";

const allEntries = readLedger(".agenteval");
const bannerEntries = readLedgerByTestId(".agenteval", "Add Close button");
const latest = getLatestEntries(".agenteval");
```

## Schema

| Field | Type | Description |
|-------|------|-------------|
| `testId` | `string` | Test title |
| `timestamp` | `string` | ISO 8601 timestamp |
| `agentRunner` | `string` | Runner name |
| `judgeModel` | `string` | Judge model used |
| `score` | `number` | 0.0 to 1.0 |
| `pass` | `boolean` | Whether it passed |
| `reason` | `string` | Judge's markdown explanation |
| `context` | `object` | Raw diff + command outputs |
| `durationMs` | `number` | Total duration in ms |
