# Getting Started

## Installation

```bash
pnpm add -D @dkt/agent-eval
```

## Quick Setup

### 1. Create a config file

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

### 2. Write your first eval test

```ts
// tests/banner.eval.ts
import { test, expect } from "@dkt/agent-eval";

test("Add a Close button to the Banner", async ({ agent, ctx }) => {
  // 1. Trigger the agent
  await agent.run("Add a Close button inside the banner component");

  // 2. Capture what changed
  ctx.storeDiff();
  await ctx.runCommand("test", "pnpm test -- Banner");
  await ctx.runCommand("build", "pnpm run build");

  // 3. Judge the result
  await expect(ctx).toPassJudge({
    criteria: `
      - Uses a proper close button component
      - Has aria-label 'Close'
      - Tests still pass
      - Build succeeds
    `,
  });
});
```

### 3. Run the evaluation

```bash
npx agenteval run
```

## What Happens

1. **Config loaded** – AgentEval reads your `agenteval.config.ts`
2. **Git reset** – Working directory is reset to HEAD before each run
3. **Agent executes** – Your configured agent runs the prompt
4. **Context captured** – Git diff and command outputs are stored
5. **Judge evaluates** – An LLM scores the agent's output (0.0–1.0)
6. **Ledger updated** – Results are appended to `.agenteval/ledger.jsonl`
