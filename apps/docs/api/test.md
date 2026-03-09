# test()

Register an evaluation test. Supports both standard runs and A/B experiments.

## Standard Test

Registers a test that will run against the `defaultRunner` defined in your config.

### Signature

```ts
function test(title: string, fn: TestFn): void;
```

### Usage

```ts
import { test, expect } from "@tlahey/agent-eval";

test("My evaluation", async ({ ctx }) => {
  ctx.prompt("Refactor this component.");
  await expect(ctx).toPassJudge({ criteria: "Code is cleaner" });
});
```

---

## A/B Testing (Variants)

Registers a test with multiple variations to compare configurations (prompts, skills, models) on the same mission.

### Signature

```ts
test(
  title: string,
  variants: TestVariant[],
  fn: TestFn
): void;
```

### Parameters

| Param      | Type            | Description                                                             |
| ---------- | --------------- | ----------------------------------------------------------------------- |
| `title`    | `string`        | Test title                                                              |
| `variants` | `TestVariant[]` | List of configurations to compare.                                      |
| `fn`       | `TestFn`        | Test logic. Mission is defined via `ctx.prompt()` inside this function. |

### TestVariant Interface

```ts
interface TestVariant {
  id: string; // Technical ID for grouping
  name: string; // Display name (e.g., "Gpt-4o Baseline")
  runnerId: string; // ID from global config registry
  enrichPrompt?: string; // Optional template: "Persona: expert. Mission: {{prompt}}"
  metadata?: Record<string, any>; // Arbitrary data accessible in test
}
```

### Usage

```ts
test(
  "Accessibility Validation",
  [
    { id: "raw", name: "Direct Sonnet", runnerId: "sonnet" },
    {
      id: "expert",
      name: "Sonnet Expert",
      runnerId: "sonnet",
      enrichPrompt: "Agis en tant qu'expert WCAG. Mission : {{prompt}}",
    },
  ],
  async ({ ctx }) => {
    ctx.prompt("Create a Dropdown component.");
    await expect(ctx).toPassJudge({ criteria: "Respects WCAG" });
  },
);
```

---

## AgentHandle

The `agent` parameter provides access to the AI agent and the current variant context.

| Prop / Method | Type     | Description                                       |
| ------------- | -------- | ------------------------------------------------- |
| `id`          | `string` | Global runner ID                                  |
| `model`       | `string` | Model identifier (e.g., "gpt-4o")                 |
| `variant`     | `object` | Current variation data (`{ id, name, metadata }`) |

---

## describe()

Group tests into named suites. Supports nesting. Captured as `suitePath` in the ledger.

```ts
import { test, describe, expect } from "@tlahey/agent-eval";

describe("UI Components", () => {
  test("Add close button", async ({ ctx }) => {
    ctx.prompt("...");
    await expect(ctx).toPassJudge({ criteria: "..." });
  });
});
```

---

## Hooks

### beforeEach() / afterEach()

Register lifecycle hooks that run around each test. Follows Vitest-style scoping.

```ts
import { test, describe, beforeEach } from "@tlahey/agent-eval";

beforeEach(({ ctx }) => {
  ctx.addTask({
    name: "Build",
    action: ({ exec }) => exec("pnpm build"),
    criteria: "Build succeeds",
  });
});
```
