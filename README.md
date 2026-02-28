<p align="center">
  <img src="assets/logo.png" alt="AgentEval" width="200" />
</p>

<h1 align="center">AgentEval</h1>

<p align="center">
  <strong>AI coding agent evaluation framework with Vitest-like DX.</strong>
</p>

<p align="center">
  Test, judge, and track AI coding agents — locally, sequentially, and model-agnostically.
</p>

---

## Features

- **Vitest-like API** — `test()` / `expect()` syntax designed for evaluating AI agents
- **Git Isolation** — automatic `git reset --hard` between runs for pristine environments
- **LLM-as-a-Judge** — structured evaluation via Anthropic, OpenAI, Ollama, or any CLI tool
- **Model Matrix** — compare multiple agents/models on the same test suite
- **Auto Hooks** — `storeDiff()` and `afterEach` commands run automatically after each agent
- **Expected Files** — scope analysis detects agents that modify too many files
- **Improvement Feedback** — judge returns actionable suggestions alongside scores
- **SQLite Ledger** — local, privacy-first historical tracking of all evaluation results
- **Visual Dashboard** — React dashboard with charts, diff viewer, and per-evaluation breakdowns
- **CLI-first** — `agenteval run`, `agenteval view`, `agenteval ledger`
- **SOLID Architecture** — modular, extensible, every module has a single responsibility

## Why We Built This

### The Paradigm Shift

Testing an AI coding agent is **fundamentally different** from testing a standard JavaScript function.

Traditional software testing evaluates deterministic inputs and outputs in memory. Testing AI coding agents, however, involves long-running tasks, heavy side-effects (mutating real files), and subjective evaluation criteria that require another LLM to act as a judge.

No existing tool was designed for this.

### Why not Vitest or Jest?

While we love the Developer Experience (DX) of Vitest, these frameworks are built for extreme speed and parallel execution. AI agents mutate the actual file system and commit to Git. Running agent tests concurrently in Vitest instantly corrupts the local repository state. Furthermore, agent tasks take minutes to run, conflicting with the millisecond timeouts expected by standard test runners.

### Why not Promptfoo?

[Promptfoo](https://github.com/promptfoo/promptfoo) is an incredible tool for Text-in/Text-out evaluation (like RAGs or Chatbots). However, evaluating code-generating agents requires running CLI commands, capturing Git diffs, and reading compilation logs. Forcing Promptfoo to handle heavy side-effects required fragile workarounds (like complex Bash escaping and JSON parsing hacks). We needed a tool natively designed for file-system operations.

### Why not Langfuse or Cloud LLMOps tools?

[Langfuse](https://langfuse.com/) is perfect for production observability, but it is not a local test runner. Moreover, sending proprietary enterprise code, Next.js build logs, and Git diffs to a third-party cloud service for evaluation raised significant data privacy and security concerns.

### What AgentEval Brings

We built AgentEval to hit the perfect sweet spot:

- **Familiar, Vitest-like syntax** — great Developer Experience with `test()` / `expect()` you already know.
- **Strict, sequential execution** — automated Git state isolation (`git reset --hard`) between every test. No concurrency corruption.
- **Provider-agnostic architecture** — easily switch between local CLIs, OpenAI, or Anthropic for both agents and LLM-as-a-Judge.
- **Local, privacy-first ledger** — track historical performance in a local SQLite database without sending your source code to the cloud.

---

## Quick Start

### Prerequisites

- **Node.js ≥ 22** (required for `node:sqlite`)
- **pnpm ≥ 10**

### Install

```bash
pnpm add -D agent-eval
```

### Configure

```ts
// agenteval.config.ts
import { defineConfig } from "agent-eval";

export default defineConfig({
  runners: [
    {
      name: "copilot",
      type: "cli",
      command: 'gh copilot suggest "{{prompt}}"',
    },
  ],
  judge: {
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
  },
  // outputDir: ".agenteval",  // default — where ledger.sqlite is stored
});
```

### Write a test

Test files are discovered automatically: `*.eval.ts` and `*.agent-eval.ts`.

```ts
// evals/banner.eval.ts
import { test, expect } from "agent-eval";

test("Add a Close button to the Banner", async ({ agent, ctx }) => {
  await agent.run("Add a Close button inside the banner component");
  // storeDiff() is automatic — no need to call it
  // afterEach commands (pnpm test, pnpm build) run automatically too

  await expect(ctx).toPassJudge({
    criteria: `
      - Uses a proper close button component
      - Has aria-label 'Close'
      - All tests pass
      - Build succeeds
    `,
    expectedFiles: ["src/components/Banner.tsx"],
  });
});
```

### Run

```bash
# Run all eval tests
npx agenteval run

# Shorthand
npx agenteval .

# Filter by test title
npx agenteval run -f banner

# Filter by tag
npx agenteval run -t ui

# Override output directory
npx agenteval run -o ./my-results
```

### View Results

```bash
# Launch the dashboard API server (default port 4747)
npx agenteval view

# Or use the alias
npx agenteval ui -p 8080

# View ledger in terminal
npx agenteval ledger

# Export as JSON
npx agenteval ledger --json > results.json
```

---

## CLI Reference

| Command            | Description                                       |
| ------------------ | ------------------------------------------------- |
| `agenteval run`    | Discover and execute eval test files sequentially |
| `agenteval .`      | Shorthand for `agenteval run`                     |
| `agenteval view`   | Launch the dashboard API server                   |
| `agenteval ui`     | Alias for `view`                                  |
| `agenteval ledger` | View evaluation results in the terminal           |

### Global Options

| Flag                 | Description                              |
| -------------------- | ---------------------------------------- |
| `-o, --output <dir>` | Override ledger directory (all commands) |

### `agenteval run` Options

| Flag                     | Description                             |
| ------------------------ | --------------------------------------- |
| `-f, --filter <pattern>` | Filter tests by title (substring match) |
| `-t, --tag <tag>`        | Filter tests by tag                     |

### `agenteval view` / `agenteval ui` Options

| Flag                | Description                      |
| ------------------- | -------------------------------- |
| `-p, --port <port>` | Port to serve on (default: 4747) |

### Dashboard API Endpoints

When `agenteval view` is running:

| Endpoint         | Description                          |
| ---------------- | ------------------------------------ |
| `GET /api/runs`  | All runs (filter with `?testId=...`) |
| `GET /api/tests` | List of unique test IDs              |
| `GET /api/stats` | Aggregate stats per runner per test  |

---

## Test File Discovery

AgentEval discovers test files matching these patterns by default:

```
**/*.eval.{ts,js,mts,mjs}
**/*.agent-eval.{ts,js,mts,mjs}
```

Customize in your config:

```ts
export default defineConfig({
  testFiles: "evals/**/*.agent-eval.ts",
  // or multiple patterns:
  // testFiles: ["evals/**/*.eval.ts", "tests/**/*.agent-eval.ts"],
});
```

---

## Database Location

The SQLite ledger (`ledger.sqlite`) is stored in your project's output directory:

| Priority | Method              | Example                         |
| -------- | ------------------- | ------------------------------- |
| 1        | CLI `--output` flag | `agenteval run -o ./my-results` |
| 2        | Config `outputDir`  | `outputDir: "./custom-output"`  |
| 3        | Default             | `.agenteval/ledger.sqlite`      |

Add `.agenteval/` to your `.gitignore`.

---

## Architecture

AgentEval follows **SOLID principles** for modularity and extensibility. See the [Architecture docs](apps/docs/guide/architecture.md) and [ADR-007](docs/adrs/007-solid-architecture.md) for details.

### Monorepo Structure

```
agent-eval/
├── apps/
│   ├── docs/                  # VitePress documentation
│   ├── eval-ui/               # Dashboard UI (React + Tailwind + Recharts)
│   └── example-target-app/    # E2E target app for integration tests
├── packages/
│   └── agent-eval/            # Core framework
│       └── src/
│           ├── index.ts       # Public API (test, expect, defineConfig)
│           ├── core/          # Types, config, context, runner, expect
│           ├── git/           # Git isolation (reset, diff)
│           ├── judge/         # LLM-as-a-Judge (Vercel AI SDK)
│           ├── ledger/        # SQLite ledger (node:sqlite)
│           └── cli/           # CLI binary (Commander.js)
├── docs/adrs/                 # Architecture Decision Records
├── AGENTS.md                  # AI agent development guide
└── PRD.md                     # Product requirements
```

### Key Design Decisions

| ADR                                          | Decision                                               |
| -------------------------------------------- | ------------------------------------------------------ |
| [001](docs/adrs/001-why-custom-framework.md) | Why a custom framework (not Vitest/Promptfoo/Langfuse) |
| [002](docs/adrs/002-sqlite-over-jsonl.md)    | SQLite over JSONL for the ledger                       |
| [003](docs/adrs/003-sequential-execution.md) | Sequential execution (no parallelism)                  |
| [004](docs/adrs/004-llm-as-judge.md)         | LLM-as-a-Judge with Vercel AI SDK                      |
| [005](docs/adrs/005-monorepo-layout.md)      | Monorepo layout (apps/ + packages/)                    |
| [006](docs/adrs/006-code-quality-gates.md)   | Code quality gates (ESLint + Prettier + Husky)         |
| [007](docs/adrs/007-solid-architecture.md)   | SOLID architecture principles                          |

---

## Development

### Prerequisites

- Node.js ≥ 22 (required for `node:sqlite`)
- pnpm ≥ 10

### Setup

```bash
git clone <repo-url>
cd agent-eval
pnpm install
```

### Commands

| Command                              | Description               |
| ------------------------------------ | ------------------------- |
| `pnpm build`                         | Build the core package    |
| `pnpm test`                          | Run all tests (196 total) |
| `pnpm lint`                          | Run ESLint                |
| `pnpm lint:fix`                      | ESLint with auto-fix      |
| `pnpm format`                        | Format with Prettier      |
| `pnpm format:check`                  | Check formatting          |
| `pnpm dev`                           | Start docs dev server     |
| `pnpm --filter agent-eval typecheck` | Type-check the framework  |

### Workflow

All 4 gates must pass before committing (enforced by Husky pre-commit hook):

1. `pnpm lint:fix && pnpm format` — Lint & format
2. `pnpm test` — All tests green
3. `pnpm build` — Build succeeds
4. `git add -A && git commit -m "type(scope): description"` — Commit when green ✅

> ⚠️ Never use `--no-verify` to bypass the pre-commit hook.

---

## Documentation

Run the docs locally:

```bash
pnpm dev
```

Covers: [Getting Started](apps/docs/guide/getting-started.md) · [Configuration](apps/docs/guide/configuration.md) · [Writing Tests](apps/docs/guide/writing-tests.md) · [Runners](apps/docs/guide/runners.md) · [Judges](apps/docs/guide/judges.md) · [Dashboard](apps/docs/guide/dashboard.md) · [CLI](apps/docs/guide/cli.md) · [Architecture](apps/docs/guide/architecture.md) · [Contributing](apps/docs/guide/contributing.md)

---

## License

ISC
