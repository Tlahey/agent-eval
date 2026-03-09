# Writing Tests

## Unified Format

AgentEval uses a unified API where the **Mission (Prompt)** is defined inside the test function for better readability.

```ts
test(
  title: string,
  variants?: TestVariant[], // Optional for A/B testing
  logic: TestFn
): void;
```

---

## Standard Test

A standard test runs against the `defaultRunner` configured in your project.

```ts
import { test, expect } from "@tlahey/agent-eval";

test("Create a debounce utility", async ({ ctx }) => {
  ctx.prompt(`
    Create a debounce function in src/utils/debounce.ts. 
    Export it as a named export.
    It must be generic and handle 'this' context correctly.
  `);

  ctx.addTask({
    name: "File exists",
    action: ({ exec }) => exec("test -f src/utils/debounce.ts && echo 'ok'"),
    criteria: "File must exist",
  });

  await expect(ctx).toPassJudge({
    criteria: "Logic is correct and typed with generics.",
    expectedFiles: ["src/utils/debounce.ts"],
  });
});
```

---

## A/B Testing (Experiments)

To compare different runners or prompt templates on the same mission, pass an array of **variants** as the 2nd argument.

```ts
test(
  "Refactor FP",
  [
    { id: "v1", name: "Standard Sonnet", runnerId: "sonnet" },
    {
      id: "v2",
      name: "FP Expert Persona",
      runnerId: "sonnet",
      enrichPrompt: "Agis comme un expert FP. Mission : {{prompt}}",
    },
  ],
  async ({ ctx }) => {
    ctx.prompt("Refactor this logic to use functional programming patterns.");

    await expect(ctx).toPassJudge({ criteria: "Code is clean" });
  },
);
```

---

## Test Logic Parameters

The logic function receives an object with:

| Parameter | Type          | Description                                   |
| --------- | ------------- | --------------------------------------------- |
| `agent`   | `AgentHandle` | Meta info about current runner and variant.   |
| `ctx`     | `TestContext` | Define prompt, capture diffs, register tasks. |
| `judge`   | `JudgeConfig` | Read-only judge configuration.                |
| `variant` | `TestVariant` | Current variation configuration (if any).     |

### ctx.prompt(text)

This method defines the mission sent to the agent. It is mandatory. Using backticks allows for long, multi-line prompts.

### AgentHandle Prop

- `agent.id`: The runner ID (e.g. "sonnet").
- `agent.model`: The model name.
- `agent.variant`: The current variant metadata.

---

## Lifecycle Hooks

Use `beforeEach` and `afterEach` for shared tasks.

```ts
import { test, beforeEach, expect } from "@tlahey/agent-eval";

beforeEach(({ ctx }) => {
  ctx.addTask({
    name: "Lint",
    action: ({ exec }) => exec("pnpm lint"),
    criteria: "No linting errors",
  });
});
```
