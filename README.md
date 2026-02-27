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
- **Local, privacy-first ledger** — track historical performance in a JSONL file without sending your source code to the cloud.

---

## Quick Start

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
});
```

### Write a test

```ts
// tests/banner.eval.ts
import { test, expect } from "agent-eval";

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
│   └── agent-eval/         # agent-eval (core framework)
│       └── src/
│           ├── index.ts    # Public API (test, expect, defineConfig)
│           ├── core/       # Types, config, context, runner, expect
│           ├── git/        # Git isolation (reset, diff)
│           ├── judge/      # LLM-as-a-Judge
│           ├── ledger/     # JSONL ledger
│           └── cli/        # CLI binary
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
| `pnpm --filter agent-eval typecheck` | Type-check the framework |

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
