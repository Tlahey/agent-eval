<p align="center">
  <img src="https://raw.githubusercontent.com/Tlahey/agent-eval/main/assets/logo.png" alt="AgentEval" width="200" />
</p>

<h1 align="center">AgentEval</h1>

<p align="center">
  <strong>AI coding agent evaluation framework with Vitest-like DX.</strong>
</p>

<p align="center">
  Test, judge, and track AI coding agents — locally, sequentially, and model-agnostically.
</p>

<p align="center">
  <a href="https://tlahey.github.io/agent-eval/">📖 Documentation</a> ·
  <a href="https://github.com/Tlahey/agent-eval">GitHub</a>
</p>

---

## Dashboard

<p align="center">
  <img src="https://raw.githubusercontent.com/Tlahey/agent-eval/main/assets/screenshots/overview.png" alt="Overview — KPIs, score trends, and resource telemetry" width="100%" />
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/Tlahey/agent-eval/main/assets/screenshots/eval-detail.png" alt="Explorer — hierarchical tree view with top agent rankings" width="100%" />
</p>

<details>
<summary>More screenshots</summary>

<p align="center">
  <img src="https://raw.githubusercontent.com/Tlahey/agent-eval/main/assets/screenshots/all-runs.png" alt="All Runs — filterable execution ledger" width="100%" />
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/Tlahey/agent-eval/main/assets/screenshots/run-detail.png" alt="Run Detail — diff viewer, judge reasoning, and metrics" width="100%" />
</p>

</details>

---

## Features

- **Vitest-like API** — `test()` / `expect()` syntax designed for evaluating AI agents
- **9 Custom Themes** — Nebula Midnight, Nord Frost, Clean Blue, Cyber Neon, Terra Earth, Admiral Navy, Vibrant Energy, and accessible options like High Contrast
- **Analytical Explorer** — hierarchical tree view with analytical metrics (run volume, agent diversity) and Top Agent #1 highlights
- **Declarative Pipeline** — `agent.instruct()` + `ctx.addTask()` for zero-boilerplate evaluations
- **Git Isolation** — automatic `git reset --hard` between runs for pristine environments
- **LLM-as-a-Judge** — structured evaluation via any `IModelPlugin` (Anthropic, OpenAI, Ollama, or custom)
- **Model Matrix** — compare multiple agents/models on the same test suite
- **Weighted Scoring** — tasks with weights for nuanced, multi-criteria evaluation
- **SQLite Ledger** — local, privacy-first historical tracking of all evaluation results
- **Zero-Flicker Persistence** — theme preferences saved in localStorage with instant application
- **Visual Dashboard** — React dashboard with charts, diff viewer, and per-evaluation breakdowns
- **CLI-first** — `agenteval run`, `agenteval ui`, `agenteval ledger`

> 📖 For a detailed comparison with Vitest, Promptfoo, and Langfuse, see [Why AgentEval?](https://tlahey.github.io/agent-eval/guide/getting-started#why-agentevalval)

---

## Quick Start

### Prerequisites

- **Node.js ≥ 22** (required for `node:sqlite`)
- **pnpm ≥ 10**

### Install

```bash
pnpm add -D @tlahey/agent-eval
```

Or install globally to use across projects:

```bash
pnpm add -g agent-eval
agenteval --version
```

### Configure

```ts
// agenteval.config.ts
import { defineConfig } from "@tlahey/agent-eval";
import { CliModel, OpenAIModel } from "@tlahey/agent-eval/llm";
import { SqliteLedger } from "@tlahey/agent-eval/ledger";

export default defineConfig({
  runners: [
    { name: "copilot", model: new CliModel({ command: 'gh copilot suggest "{{prompt}}"' }) },
  ],
  judge: {
    model: new OpenAIModel({ model: "gpt-4o" }),
  },
  ledger: new SqliteLedger({ outputDir: ".agenteval" }),
});
```

### Write a test

```ts
// evals/banner.eval.ts
import { test, expect } from "@tlahey/agent-eval";

test("Add a Close button to the Banner", ({ agent, ctx }) => {
  agent.instruct("Add a Close button to the Banner component");

  ctx.addTask({
    name: "Close button renders",
    action: () => ctx.exec('grep -q "aria-label" src/components/Banner.tsx && echo "found"'),
    criteria: 'A close button with aria-label="Close" is rendered',
    weight: 3,
  });

  expect(ctx).toPassJudge({
    criteria: "Uses a proper close button, has aria-label, build succeeds",
    expectedFiles: ["src/components/Banner.tsx"],
  });
});
```

### Run & View

```bash
npx agenteval run    # Run evaluations
npx agenteval ui     # Launch visual dashboard (port 4747)
```

---

## Architecture

AgentEval uses a **Plugin Architecture** based on SOLID principles. Every concern (LLM, Ledger, Environment, Judge) is a swappable plugin.

| Interface            | Built-in Implementations                       |
| -------------------- | ---------------------------------------------- |
| `IModelPlugin`       | `AnthropicModel`, `OpenAIModel`, `OllamaModel` |
| `ILedgerPlugin`      | `SqliteLedger`, `JsonLedger`                   |
| `IEnvironmentPlugin` | `LocalEnvironment`, `DockerEnvironment`        |

---

## Development

```bash
pnpm build    # Build both UI and Framework
pnpm test     # Run full test suite
pnpm lint     # Lint & Format
```

---

## License

ISC
