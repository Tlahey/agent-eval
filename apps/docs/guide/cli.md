# CLI Reference

## `agenteval run`

Execute evaluation tests.

```bash
agenteval run [options]
```

### Options

| Flag | Description |
|------|-------------|
| `-c, --config <path>` | Path to config file |
| `-f, --filter <pattern>` | Filter tests by title (substring match) |
| `-t, --tag <tag>` | Filter tests by tag |

### Examples

```bash
# Run all tests
agenteval run

# Run tests matching "Banner"
agenteval run -f banner

# Run tests tagged "ui"
agenteval run -t ui
```

## `agenteval ledger`

View evaluation results.

```bash
agenteval ledger [options]
```

### Options

| Flag | Description |
|------|-------------|
| `--json` | Output full JSON |

### Examples

```bash
# View latest 20 entries
agenteval ledger

# Export as JSON
agenteval ledger --json > results.json
```

## `agenteval ui`

Launch the visual dashboard (Phase 2 – coming soon).

```bash
agenteval ui
```
