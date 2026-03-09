<p align="center">
  <img src="https://raw.githubusercontent.com/Tlahey/agent-eval/main/assets/logo.png" alt="AgentEval" width="200" />
</p>

<h1 align="center">AgentEval</h1>

<p align="center">
  <strong>AI coding agent evaluation framework with Vitest-like DX.</strong>
</p>

<p align="center">
  Test, judge, and track AI coding agents — locally, in parallel, and model-agnostically.
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

---

## Features

- **Everything is a Variant** — Unified API for single runs and A/B experiments.
- **Isolated Parallel Execution** — Support for Docker and macOS sandbox-exec to run multiple agents simultaneously.
- **Zero Magic Philosophy** — Explicit runner selection per test for total budget and execution control.
- **Analytical Explorer** — Hierarchical tree view with analytical metrics and agent rankings.
- **Git Isolation** — Automatic workspace cleaning or temporary directory cloning.
- **LLM-as-a-Judge** — Structured evaluation via Anthropic, OpenAI, Ollama, or GitHub Models.
- **Visual Dashboard** — React dashboard with charts, diff viewer, and delta analysis for experiments.

---

## Quick Start

### Prerequisites

- **Node.js ≥ 22** (required for `node:sqlite`)
- **pnpm ≥ 10**

### Install

```bash
pnpm add -D @tlahey/agent-eval
```

### Configure

AgentEval uses a registry model. Define your resources once, use them by ID in tests.

```ts
// agenteval.config.ts
import { defineConfig } from "@tlahey/agent-eval";
import { CliModel, OpenAIModel } from "@tlahey/agent-eval/llm";
import { DockerEnvironment } from "@tlahey/agent-eval/environment";

export default defineConfig({
  // Library of available technical resources
  runners: [
    { id: "copilot", model: new CliModel({ command: 'gh copilot suggest "{{prompt}}"' }) },
    { id: "sonnet", model: new AnthropicModel({ model: "claude-3-5-sonnet-latest" }) },
  ],
  judge: {
    model: new OpenAIModel({ model: "gpt-4o" }),
  },
  // Enable parallel execution via Docker (optional)
  environment: new DockerEnvironment({ image: "node:22" }),
});
```

### Write a test (Baseline)

Every test requires an explicit variant array.

```ts
// evals/banner.eval.ts
import { test, expect } from "@tlahey/agent-eval";

test("Add a Close button", [{ name: "Baseline", runner: "sonnet" }], async ({ ctx }) => {
  ctx.prompt("Add a Close button to the Banner component");

  ctx.addTask({
    name: "Check component",
    action: ({ exec }) => exec('grep -q "aria-label" src/components/Banner.tsx'),
    criteria: "Navbar should contain 'aria-label' for accessibility",
  });

  await expect(ctx).toPassJudge({
    criteria: "Uses a proper close button, accessibility is respected.",
    expectedFiles: ["src/components/Banner.tsx"],
  });
});
```

---

## A/B Testing (Experiments)

Compare models or prompt engineering strategies by adding more variants.

```ts
test(
  "Refactor Logic",
  [
    { name: "Direct", runner: "sonnet" },
    {
      name: "Expert Persona",
      runner: "sonnet",
      enrichPrompt: "Act as a Senior Engineer. Mission: {{prompt}}",
    },
    { name: "GPT-4o", runner: "gpt4" },
  ],
  async ({ ctx }) => {
    ctx.prompt("Refactor the auth middleware to use JWT.");
    await expect(ctx).toPassJudge({ criteria: "Logic is secure and idiomatic." });
  },
);
```

---

## Real World Examples

Check out our [Example Target App](https://github.com/Tlahey/agent-eval/tree/main/apps/example-target-app/evals) for complete scenarios:

- [Anthropic Claude Sonnet](https://github.com/Tlahey/agent-eval/tree/main/apps/example-target-app/evals/anthropic)
- [Aider CLI agent](https://github.com/Tlahey/agent-eval/tree/main/apps/example-target-app/evals/cli-aider)
- [Local Ollama (Llama3)](https://github.com/Tlahey/agent-eval/tree/main/apps/example-target-app/evals/ollama)
- [A/B Prompt Engineering Experiments](https://github.com/Tlahey/agent-eval/tree/main/apps/example-target-app/evals/experiments)

---

## License

ISC
