# Writing Tests

## File Naming

Test files are discovered automatically using these patterns:

- `*.eval.ts` / `*.eval.js` / `*.eval.mts` / `*.eval.mjs`
- `*.agent-eval.ts` / `*.agent-eval.js` / `*.agent-eval.mts` / `*.agent-eval.mjs`

Place them anywhere in your project (except `node_modules/` and `dist/`).

## Basic Structure

Every eval test follows this pattern:

```ts
import { test, expect } from "agent-eval";

test("Test title", async ({ agent, ctx }) => {
  // 1. Run the agent
  await agent.run("Your instruction to the agent");

  // 2. Capture context
  ctx.storeDiff();
  await ctx.runCommand("name", "command to run");

  // 3. Judge the output
  await expect(ctx).toPassJudge({
    criteria: "Your evaluation criteria in Markdown",
  });
});
```

## The Test Function

The `test()` function receives an object with:

- **`agent`** – Handle to trigger the AI agent
- **`ctx`** – Test context for capturing diffs and command outputs
- **`judge`** – The judge configuration (read-only)

## Capturing Context

### `ctx.storeDiff()`

Captures the current `git diff` (staged + unstaged). Call this after the agent runs.

### `ctx.runCommand(name, command)`

Runs a shell command and stores its result (stdout, stderr, exit code, duration).

```ts
await ctx.runCommand("test", "pnpm test -- Banner");
await ctx.runCommand("build", "pnpm run build");
await ctx.runCommand("lint", "pnpm run lint");
```

## Evaluation Criteria

The `criteria` string supports Markdown. Be specific:

```ts
await expect(ctx).toPassJudge({
  criteria: `
    - Component renders a close button with <IconButton>
    - Button has aria-label="Close"
    - Click handler calls onClose prop
    - All existing tests still pass
    - Build compiles without errors
    - No TypeScript errors
  `,
});
```

## Tagged Tests

```ts
test.tagged(["ui", "banner"], "Add Close button", async ({ agent, ctx }) => {
  // ...
});
```

## Skipping Tests

```ts
test.skip("Not ready yet", async ({ agent, ctx }) => {
  // This test won't run
});
```

## Multiple Assertions

You can make multiple judge calls in one test:

```ts
test("Complex feature", async ({ agent, ctx }) => {
  await agent.run("Add search with debounce");
  ctx.storeDiff();

  await ctx.runCommand("test", "pnpm test");

  await expect(ctx).toPassJudge({
    criteria: "Search input renders correctly",
  });

  await expect(ctx).toPassJudge({
    criteria: "Debounce is implemented with 300ms delay",
    model: "gpt-4o", // Use a different judge model
  });
});
```
