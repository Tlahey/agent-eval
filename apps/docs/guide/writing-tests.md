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
  // 1. Run the agent (storeDiff is called automatically after this)
  await agent.run("Your instruction to the agent");

  // 2. Judge the output
  await expect(ctx).toPassJudge({
    criteria: "Your evaluation criteria in Markdown",
  });
});
```

::: tip Automatic post-agent hooks
`storeDiff()` is called **automatically** after `agent.run()`. You can also define global `afterEach` commands in your config to run tests, builds, or linters automatically — no need to call them manually in every eval file. See [Configuration](./configuration.md#automatic-post-agent-hooks).
:::

## The Test Function

The `test()` function receives an object with:

- **`agent`** – Handle to trigger the AI agent
- **`ctx`** – Test context for capturing diffs and command outputs
- **`judge`** – The judge configuration (read-only)

## Capturing Context

### `ctx.storeDiff()`

Captures the current `git diff` (staged + unstaged). **Called automatically** after `agent.run()`. You only need to call it manually if you want to capture a diff at a specific point before judging.

### `ctx.runCommand(name, command)`

Runs a shell command and stores its result (stdout, stderr, exit code, duration). For commands that should run after every agent execution (tests, builds, linters), use the `afterEach` config option instead.

```ts
// Manual call (for one-off commands in specific tests)
await ctx.runCommand("test", "pnpm test -- Banner");

// Preferred: use afterEach in config for recurring commands
// See Configuration > Automatic Post-Agent Hooks
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
