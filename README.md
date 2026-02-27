# 🧪 AgentEval

**AI coding agent evaluation framework with Vitest-like DX.**

Test, judge, and track AI coding agents — locally, sequentially, and model-agnostically.

---

## Features

- **Vitest-like API** — `test()` / `expect()` syntax designed for evaluating AI agents
- **Git Isolation** — automatic `git reset --hard` between runs for pristine environments
- **LLM-as-a-Judge** — structured evaluation via Anthropic, OpenAI, or local Ollama
- **Model Matrix** — compare multiple agents/models on the same test suite
- **Data Ledger** — JSONL-based historical tracking of all evaluation results
- **CLI** — `agenteval run`, `agenteval ledger`, and more

## Quick Start

### Install

```bash
pnpm add -D @dkt/agent-eval
```

### Configure

```ts
// agenteval.config.ts
import { defineConfig } from "@dkt/agent-eval";

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
});
```

### Write a test

```ts
// tests/banner.eval.ts
import { test, expect } from "@dkt/agent-eval";

test("Add a Close button to the Banner", async ({ agent, ctx }) => {
  await agent.run("Add a Close button inside the banner component");

  ctx.storeDiff();
  await ctx.runCommand("test", "pnpm test -- Banner");
  await ctx.runCommand("build", "pnpm run build");

  await expect(ctx).toPassJudge({
    criteria: `
      - Uses a proper close button component
      - Has aria-label 'Close'
      - All tests pass
      - Build succeeds
    `,
  });
});
```

### Run

```bash
npx agenteval run
```

---

## Monorepo Structure

```
agent-eval/
├── apps/
│   └── docs/               # VitePress documentation
├── packages/
│   └── agent-eval/         # @dkt/agent-eval (core framework)
│       └── src/
│           ├── index.ts    # Public API (test, expect, defineConfig)
│           ├── cli.ts      # CLI (agenteval run|ledger|ui)
│           ├── runner.ts   # Sequential test runner
│           ├── context.ts  # TestContext (storeDiff, runCommand)
│           ├── judge.ts    # LLM-as-a-Judge
│           ├── git.ts      # Git isolation
│           ├── ledger.ts   # JSONL ledger
│           ├── config.ts   # Config loader
│           ├── expect.ts   # Fluent assertion API
│           └── types.ts    # TypeScript interfaces
├── examples/               # Example config + test files
├── AGENTS.md               # AI agent development guide
└── PRD.md                  # Product requirements
```

## Development

### Prerequisites

- Node.js ≥ 18
- pnpm ≥ 10

### Setup

```bash
git clone <repo-url>
cd agent-eval
pnpm install
```

### Commands

| Command | Description |
|---------|-------------|
| `pnpm build` | Build the core package |
| `pnpm test` | Run unit tests (vitest) |
| `pnpm dev` | Start docs dev server |
| `pnpm docs:build` | Build docs for production |
| `pnpm --filter @dkt/agent-eval typecheck` | Type-check the framework |

### Workflow

1. Make your changes
2. Run `pnpm test` to verify
3. Run `pnpm build` to ensure the build passes
4. Commit when green ✅

---

## Documentation

Run the docs locally:

```bash
pnpm dev
```

Covers: [Getting Started](apps/docs/guide/getting-started.md) · [Configuration](apps/docs/guide/configuration.md) · [Writing Tests](apps/docs/guide/writing-tests.md) · [Judges](apps/docs/guide/judges.md) · [CLI](apps/docs/guide/cli.md) · [API Reference](apps/docs/api/)

---

## License

ISC
