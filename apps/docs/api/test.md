# test()

Register an evaluation test.

## Signature

```ts
function test(title: string, fn: TestFn): void
```

## Parameters

| Param | Type | Description |
|-------|------|-------------|
| `title` | `string` | Test title (used as the test ID in the ledger) |
| `fn` | `TestFn` | Async function receiving `{ agent, ctx, judge }` |

## Usage

```ts
import { test, expect } from "agent-eval";

test("My evaluation", async ({ agent, ctx }) => {
  await agent.run("Do something");
  ctx.storeDiff();
  await expect(ctx).toPassJudge({ criteria: "..." });
});
```

## Variants

### `test.tagged(tags, title, fn)`

Register a test with tags for filtering.

```ts
test.tagged(["ui"], "Banner test", async ({ agent, ctx }) => { ... });
```

### `test.skip(title, fn)`

Skip a test (it won't be executed).

```ts
test.skip("WIP test", async ({ agent, ctx }) => { ... });
```
