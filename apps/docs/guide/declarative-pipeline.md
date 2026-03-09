# Mission-Based Testing

AgentEval has moved to a **purely mission-based** approach. All tests are now declarative: you define the **Mission** (what to do) using `ctx.prompt()` and the **Logic** (how to validate it).

## Separation of Concerns

```mermaid
flowchart LR
  A["Mission (ctx.prompt)"] --> B["Automatic Execution"]
  B --> C["Test Logic (Validation)"]
  C --> D["LLM Judge"]

  style A fill:#6366f1,color:#fff
  style B fill:#f59e0b,color:#000
  style C fill:#10b981,color:#fff
```

### Why this change?

1.  **Impartial A/B Testing**: By defining the mission once at the test level, we ensure that every variant (persona, model, skills) receives the **exact same baseline instruction**.
2.  **Zero Boilerplate**: You no longer need to call `agent.run()` or `agent.instruct()` manually. The framework handles it.
3.  **Better DX**: Using backticks inside the test function allows for long, multi-line prompts without cluttering the test registration.

---

## Migration Guide

If you were using the imperative or old declarative styles, follow these steps to migrate to the unified `test` API.

### From Imperative (`agent.run`)

**Old:**

```ts
test("Add button", async ({ agent, ctx }) => {
  await agent.run("Add a button");
  await expect(ctx).toPassJudge({ criteria: "Button exists" });
});
```

**New:**

```ts
test("Add button", async ({ ctx }) => {
  ctx.prompt("Add a button");
  await expect(ctx).toPassJudge({ criteria: "Button exists" });
});
```

### From Old Declarative (`agent.instruct`)

**Old:**

```ts
test("Add button", "Add a button", async ({ ctx }) => {
  ctx.addTask({ ... });
  await expect(ctx).toPassJudge({ ... });
});
```

**New:**

```ts
test("Add button", async ({ ctx }) => {
  ctx.prompt("Add a button");
  ctx.addTask({ ... });
  await expect(ctx).toPassJudge({ ... });
});
```

---

## Weighted Tasks

Tasks registered via `ctx.addTask` are executed **after** the mission is completed by the agent but **before** the judge evaluates the results.

```ts
test("Performance test", async ({ ctx }) => {
  ctx.prompt("Optimize the heavy-loop.ts file.");

  ctx.addTask({
    name: "Benchmarks",
    action: ({ exec }) => exec("pnpm bench"),
    criteria: "Execution time must be under 100ms",
    weight: 5, // High influence on final score
  });

  await expect(ctx).toPassJudge({ criteria: "Code uses O(n) complexity" });
});
```

The results of these tasks are automatically injected into the judge's prompt to provide structured evidence for the final scoring.
