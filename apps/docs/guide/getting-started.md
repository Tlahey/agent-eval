# Getting Started

## Installation

```bash
pnpm add -D @tlahey/agent-eval
```

## Quick Setup

### 1. Create a config file

```ts
// agenteval.config.ts
import { defineConfig } from "@tlahey/agent-eval";
import { AnthropicModel } from "@tlahey/agent-eval/llm";

export default defineConfig({
  runners: [{ id: "sonnet", model: new AnthropicModel({ model: "claude-3-5-sonnet-20241022" }) }],
  defaultRunner: "sonnet",
  judge: {
    model: new AnthropicModel({ model: "claude-3-5-sonnet-20241022" }),
  },
});
```

### 2. Write your first eval test

Test files use `*.eval.ts` or `*.agent-eval.ts`. Define your mission using `ctx.prompt()`.

```ts
// evals/banner.eval.ts
import { test, expect } from "@tlahey/agent-eval";

test("Add Close Button", async ({ ctx }) => {
  ctx.prompt(`
    Add a close button to the Banner component.
    It should accept an onClose prop and render an 'x' button.
  `);

  await expect(ctx).toPassJudge({
    criteria: "Uses a proper button element with aria-label 'Close'",
  });
});
```

### 3. Run the evaluation

```bash
npx agenteval run
```

### 4. View the results

```bash
npx agenteval ui
```
