# Architecture

AgentEval follows **SOLID principles** to stay modular, testable, and extensible.

## Module Map

```
packages/agent-eval/src/
├── core/           SRP: Each file = one concern
│   ├── types.ts        All TypeScript interfaces
│   ├── config.ts       Config file loading & defaults
│   ├── context.ts      TestContext (storeDiff, runCommand)
│   ├── runner.ts       Sequential test execution engine
│   └── expect.ts       Fluent assertion API
├── git/
│   └── git.ts          Git isolation (reset, clean, diff)
├── judge/
│   └── judge.ts        LLM-as-a-Judge evaluation
├── ledger/
│   └── ledger.ts       SQLite persistence & queries
├── cli/
│   └── cli.ts          CLI command parsing
└── index.ts            Public API surface
```

## SOLID in Practice

### Single Responsibility (SRP)

Each module has **one reason to change**. The runner orchestrates tests but doesn't know how Git works. The judge evaluates diffs but doesn't know how they were produced.

**Rule of thumb:** If a file exceeds ~200 lines or handles two concerns, split it.

### Open/Closed (OCP)

Adding a new runner provider means adding a `case` in `resolveRunnerModel()` — the runner engine itself never changes. Same for judges via `resolveModel()`.

```typescript
// To add a new provider, add one case — nothing else changes
case "mistral":
  return createMistral({ apiKey })(model);
```

### Liskov Substitution (LSP)

All runners implement the `AgentHandle` interface. The engine calls `agent.run(prompt)` regardless of whether it's a CLI spawn or an API call:

```typescript
interface AgentHandle {
  run(prompt: string): Promise<void>;
  readonly name: string;
  readonly model: string;
}
```

### Interface Segregation (ISP)

Interfaces are small and focused. Test functions receive only what they need:

| Interface      | Methods/Props                                     | Consumer                 |
| -------------- | ------------------------------------------------- | ------------------------ |
| `AgentHandle`  | `run()`, `name`, `model`                          | Test functions           |
| `TestContext`  | `storeDiff()`, `runCommand()`, `diff`, `commands` | Test functions           |
| `JudgeOptions` | `criteria`, `model?`                              | `expect().toPassJudge()` |

### Dependency Inversion (DIP)

High-level modules (runner, judge) depend on **abstractions** (`AgentEvalConfig`, `JudgeConfig`), not concrete SDK implementations. Provider SDKs are **dynamically imported** at runtime:

```typescript
// No static import — loaded only when needed
const { createAnthropic } = await import("@ai-sdk/anthropic");
```

This keeps the bundle small and avoids forcing users to install SDKs they don't use.

## Sequential Execution

All tests run **sequentially** (no concurrency). This is intentional — agents mutate the filesystem and Git state. See [ADR-003](/guide/adrs#003-sequential-execution) for details.

## Git Isolation

Before each test iteration: `git reset --hard HEAD && git clean -fd`. This guarantees a pristine working directory. Never skip this step.

## Data Flow

```
agenteval run
  │
  ├─ Load config (agenteval.config.ts)
  ├─ Discover test files (*.eval.ts, *.agent-eval.ts)
  ├─ For each test file:
  │   ├─ Import file (registers tests via test())
  │   └─ For each test × runner:
  │       ├─ git reset --hard && git clean -fd
  │       ├─ agent.run(prompt)
  │       ├─ ctx.storeDiff() + ctx.runCommand()
  │       ├─ expect(ctx).toPassJudge({ criteria })
  │       ├─ Append result to SQLite ledger
  │       └─ Print pass/fail
  └─ Print summary
```

## Extending the Framework

| What                | Where              | How                                                  |
| ------------------- | ------------------ | ---------------------------------------------------- |
| New runner provider | `core/runner.ts`   | Add a `case` in `resolveRunnerModel()`               |
| New judge provider  | `judge/judge.ts`   | Add a `case` in `resolveModel()`                     |
| New CLI command     | `cli/cli.ts`       | Add `program.command()`                              |
| New context method  | `core/context.ts`  | Add to `TestContext` interface + `EvalContext` class |
| New ledger query    | `ledger/ledger.ts` | Add a new exported function                          |

See [ADR-007: SOLID Architecture](/guide/adrs#007-solid-architecture) for the full decision record.
