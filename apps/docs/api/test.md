# test()

Register an evaluation test. Every test strictly requires three arguments: title, variants, and the logic function.

## Signature

```ts
function test<TRunnerId extends string = string>(
  title: string,
  variants: TestVariant<TRunnerId>[],
  logic: TestFn<TRunnerId>,
): void;
```

---

## Defining a Test (Baseline)

Even for a simple test, you must explicitly define which runner to use via a variant array. This is your **Baseline**.

```ts
import { test, expect } from "@tlahey/agent-eval";

test("Add a Close button", [{ name: "Claude 3.5 Sonnet", runner: "sonnet" }], async ({ ctx }) => {
  ctx.prompt("Add a close button to the Banner component");

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

To compare different runners or prompt templates on the same mission, simply add more variants to the array. If the environment supports it (e.g. Docker), variants will run in **parallel**.

```ts
test(
  "Refactor FP",
  [
    { name: "Standard Sonnet", runner: "sonnet" },
    {
      name: "FP Expert Persona",
      runner: "sonnet",
      enrichPrompt: "Agis comme un expert FP. Mission : {{prompt}}",
    },
    { name: "GPT-4o Baseline", runner: "gpt4" },
  ],
  async ({ ctx }) => {
    ctx.prompt("Refactor this logic to use functional programming patterns.");

    await expect(ctx).toPassJudge({ criteria: "Code is clean and idiomatic." });
  },
);
```

---

## AgentHandle

The `agent` parameter provides access to the AI agent and the current variant context.

| Prop / Method | Type     | Description                                   |
| ------------- | -------- | --------------------------------------------- |
| `id`          | `string` | Global runner ID                              |
| `model`       | `string` | Model identifier (e.g., "gpt-4o")             |
| `variant`     | `object` | Current variation data (`{ name, metadata }`) |

---

## createTest()

Helper to create a type-safe test registration function tied to your runner IDs.

```ts
import { createTest } from "@tlahey/agent-eval";

type MyRunners = "sonnet" | "gpt4" | "aider";
const test = createTest<MyRunners>();

test("Mission", [
  { name: "V1", runner: "sonnet" } // Autocomplete for runner IDs!
], ({ ctx }) => { ... });
```

---

## describe()

Group tests into named suites. Captured as `suitePath` in the ledger.

```ts
import { test, describe, expect } from "@tlahey/agent-eval";

describe("UI Components", () => {
  test("Add close button", [{ name: "Sonnet", runner: "sonnet" }], async ({ ctx }) => {
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
