# AGENTS.md – AgentEval Framework Development Guide

This file provides instructions for AI coding agents working on the AgentEval framework codebase.

---

## 📦 Project Overview

**AgentEval** is a local, agnostic, sequential testing framework to evaluate AI coding agents. It provides a Vitest-like DX for orchestrating, isolating (via Git), evaluating (via LLM-as-a-Judge), and tracking AI agent performance.

### Monorepo Structure

```
agent-eval/
├── AGENTS.md              ← You are here
├── PRD.md                 ← Product requirements document
├── pnpm-workspace.yaml    ← Workspace config (apps/* + packages/*)
├── apps/
│   └── docs/              ← VitePress documentation site
├── packages/
│   └── agent-eval/        ← Core framework (@dkt/agent-eval)
│       ├── src/
│       │   ├── index.ts   ← Public API (test, expect, defineConfig)
│       │   ├── cli.ts     ← CLI binary (agenteval run|ledger|ui)
│       │   ├── runner.ts  ← Sequential test execution engine
│       │   ├── context.ts ← TestContext (storeDiff, runCommand)
│       │   ├── judge.ts   ← LLM-as-a-Judge (Anthropic/OpenAI/Ollama)
│       │   ├── git.ts     ← Git isolation (reset --hard, clean -fd)
│       │   ├── ledger.ts  ← JSONL ledger read/write
│       │   ├── config.ts  ← Config file loader (jiti)
│       │   ├── expect.ts  ← Fluent assertion API
│       │   └── types.ts   ← All TypeScript interfaces
│       ├── tsup.config.ts ← Build config
│       └── tsconfig.json
└── examples/              ← Example eval test files
```

---

## 🛠️ Development Commands

```bash
# Install all dependencies
pnpm install

# Build the core package
pnpm build

# Run unit tests
pnpm test

# Run the docs site locally
pnpm dev

# Type-check the core package
pnpm --filter @dkt/agent-eval typecheck
```

---

## ✅ Mandatory Workflow: Test → Build → Commit

**Every change MUST follow this workflow. No exceptions.**

### 1. Run tests before anything else
```bash
pnpm test
```
All tests must pass. If a test fails, fix it before proceeding.

### 2. Run the build
```bash
pnpm build
```
Build must succeed with zero errors.

### 3. Commit when green
Once tests pass and build succeeds, **always commit immediately**:
```bash
git add -A
git commit -m "<type>(<scope>): <description>"
```

### Commit Convention
Use [Conventional Commits](https://www.conventionalcommits.org/):

| Type | When |
|------|------|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `test` | Adding or updating tests |
| `refactor` | Code change that neither fixes nor adds |
| `docs` | Documentation only |
| `chore` | Build config, deps, tooling |

Examples:
```bash
git commit -m "feat(runner): add timeout support for agent execution"
git commit -m "fix(ledger): handle empty JSONL file gracefully"
git commit -m "test(context): add unit tests for storeDiff and runCommand"
git commit -m "docs(readme): add quick start guide"
```

### ⚠️ Rules
- **NEVER leave working code uncommitted.** If it passes tests and builds, commit it.
- **NEVER commit broken code.** Always run `pnpm test && pnpm build` first.
- **Commit frequently.** Small, focused commits are better than large ones.
- **Write tests for every new feature or bug fix.** Tests live in `packages/agent-eval/src/__tests__/`.
- **If you're unsure whether to commit, commit.** You can always amend or squash later.

### Testing Guidelines
- Tests use **Vitest** and live in `packages/agent-eval/src/__tests__/`
- Name test files `<module>.test.ts` (e.g., `ledger.test.ts`, `context.test.ts`)
- Use `describe` / `it` blocks with clear descriptions
- Mock external dependencies (git commands, LLM APIs) — don't make real API calls in tests
- Test edge cases: empty inputs, missing files, malformed data

---

## 🏗️ Architecture Principles

### Sequential Execution
All tests run **sequentially** (no concurrency). This is intentional – agents mutate the filesystem and Git state, so parallel execution would cause conflicts. The runner uses `for...of` loops.

### Git Isolation
Before each test iteration, the runner executes `git reset --hard HEAD && git clean -fd`. This guarantees a pristine working directory. **Never** skip git reset between test runs.

### LLM-as-a-Judge
The judge module uses the Vercel AI SDK (`ai` package) with structured output (`generateObject` + Zod schema) to guarantee the judge returns `{ pass, score, reason }`. The judge prompt includes the git diff and all command outputs from the test context.

### JSONL Ledger
All results are appended to `.agenteval/ledger.jsonl`. Each line is a self-contained JSON object. This format is:
- Append-only (no corruption risk)
- Streamable for the dashboard
- Git-friendly (line-based diffs)

---

## 📝 Coding Conventions

### TypeScript
- **Strict mode** enabled. No `any` types.
- Use **explicit return types** on exported functions.
- All types live in `types.ts` – import from there.
- Use `.js` extensions in imports (ESM resolution).

### Naming
- Files: `kebab-case.ts`
- Types/Interfaces: `PascalCase`
- Functions/variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE` only for true constants

### Error Handling
- Throw descriptive `Error` objects with context.
- Runner catches errors per-test and records them in the ledger.
- Never let a single test failure crash the entire run.

### Imports
- Node built-ins: `import { x } from "node:fs"`
- Internal: relative paths with `.js` extension
- External: bare specifiers

---

## 🧪 Adding a New Feature

### Adding a new Judge provider
1. Add the provider type to `JudgeConfig.provider` in `types.ts`
2. Add a new `case` in `resolveModel()` in `judge.ts`
3. Install the AI SDK provider package if needed
4. Add docs in `docs/guide/judges.md`

### Adding a new CLI command
1. Add the command in `cli.ts` using `program.command()`
2. Update the docs in `docs/guide/cli.md`

### Adding a new Context utility
1. Add the method signature to `TestContext` interface in `types.ts`
2. Implement in `EvalContext` class in `context.ts`
3. Update docs in `docs/api/context.md`

### Modifying the Ledger schema
1. Update `LedgerEntry` in `types.ts`
2. Ensure backward compatibility (new fields should be optional)
3. Update `appendLedgerEntry` and `readLedger` in `ledger.ts`

---

## ⚠️ Common Pitfalls

1. **Don't use `execSync` with `stdio: "inherit"` in context.runCommand** – we need to capture stdout/stderr.
2. **Don't run tests in parallel** – Git state will be corrupted.
3. **Always use `encoding: "utf-8"`** when capturing exec output.
4. **Don't forget `.js` extensions** in ESM imports.
5. **The judge prompt is critical** – changes to `buildJudgePrompt()` affect all evaluations.

---

## 🔮 Roadmap (from PRD)

- **Phase 1** (current): Core runner, config, test/expect API, CLI, ledger
- **Phase 2**: Visual dashboard (Vite + React + Recharts), served via `agenteval ui`
- **Future**: API-based agent runners, CI/CD integration, benchmark suites
