# expect()

Create a fluent assertion chain for LLM-as-a-Judge evaluation.

## Signature

```ts
function expect(ctx: TestContext): ExpectChain;
```

## Methods

### `.toPassJudge(options)`

```ts
interface JudgeOptions {
  criteria: string; // Markdown evaluation criteria
  model?: string; // Optional model override
}
```

Returns a `Promise<JudgeResult>`:

```ts
interface JudgeResult {
  pass: boolean; // true if score >= 0.7
  score: number; // 0.0 to 1.0
  reason: string; // Markdown explanation
}
```

## Usage

```ts
import { test, expect } from "agent-eval";

test("Example", async ({ agent, ctx }) => {
  await agent.run("Add feature X");
  ctx.storeDiff();

  const result = await expect(ctx).toPassJudge({
    criteria: "Feature X is properly implemented",
    model: "claude-sonnet-4-20250514",
  });

  // result.score, result.reason are available
});
```

## Behavior

- **Passes** if the judge returns `score >= 0.7`
- **Throws** a `JudgeFailure` error if the score is below 0.7
- The result is automatically recorded in the ledger
