# ADR-007: SOLID Architecture Principles

## Status

Accepted

## Context

AgentEval is designed to be extended by the community — new runners (CLI or API), new judge providers, new ledger backends, and new CLI commands. Maintaining a clean, modular architecture is critical to avoid tight coupling and enable contributions without breaking existing functionality.

## Decision

We adopt **SOLID principles** as the guiding philosophy for all code in the `packages/agent-eval` core:

### 1. Single Responsibility Principle (SRP)

Each module has exactly one reason to change:

| Module             | Responsibility                           |
| ------------------ | ---------------------------------------- |
| `core/config.ts`   | Loading and merging configuration        |
| `core/runner.ts`   | Orchestrating sequential test execution  |
| `core/context.ts`  | Collecting diffs and command outputs     |
| `core/expect.ts`   | Fluent assertion API                     |
| `git/git.ts`       | Git isolation (reset, clean, diff)       |
| `judge/judge.ts`   | LLM-as-a-Judge evaluation                |
| `ledger/ledger.ts` | SQLite persistence and queries           |
| `cli/cli.ts`       | CLI command parsing and user interaction |

**Rule:** If a module grows beyond ~200 lines or handles two concerns, split it.

### 2. Open/Closed Principle (OCP)

The framework is **open for extension, closed for modification**:

- **Runners**: Add a new provider by adding a `case` in `resolveRunnerModel()` — no changes to the runner orchestration logic.
- **Judges**: Add a new provider by adding a `case` in `resolveModel()` — no changes to the judge evaluation logic.
- **Test file patterns**: Users configure `testFiles` globs — no changes to the discovery engine.

### 3. Liskov Substitution Principle (LSP)

All runners (CLI and API) implement the same `AgentHandle` interface:

```typescript
interface AgentHandle {
  run(prompt: string): Promise<void>;
  readonly name: string;
  readonly model: string;
}
```

The runner engine calls `agent.run(prompt)` without knowing whether it spawns a CLI process or calls an API. Any `AgentHandle` implementation can be substituted without changing the caller.

### 4. Interface Segregation Principle (ISP)

Interfaces are small and focused:

- `TestContext` — only diff/command methods the test function needs
- `JudgeOptions` — only `criteria` and optional `model` override
- `AgentHandle` — only `run()`, `name`, `model`

No client is forced to depend on methods it doesn't use. For example, `TestContext` doesn't expose ledger operations — those are internal to the runner.

### 5. Dependency Inversion Principle (DIP)

High-level modules depend on abstractions, not concrete implementations:

- The runner depends on `AgentEvalConfig` and `TestDefinition` interfaces, not on specific provider SDKs.
- Provider SDKs (`@ai-sdk/anthropic`, `@ai-sdk/openai`) are **dynamically imported** at runtime — the runner module has zero static coupling to any provider.
- The judge accepts a `JudgeConfig` interface and resolves the concrete model at runtime.

## Consequences

- New contributors can add features (providers, commands, ledger backends) without touching core logic.
- Each module can be unit-tested in isolation with minimal mocking.
- Dynamic imports keep the bundle size small — unused providers are never loaded.
- The codebase remains navigable as it grows, because each file has a clear, bounded responsibility.
