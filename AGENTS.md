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
├── .github/workflows/
│   └── ci.yml             ← CI pipeline (test → build → typecheck)
├── docs/
│   └── adrs/              ← Architecture Decision Records
│       ├── 001-why-custom-framework.md
│       ├── 002-sqlite-over-jsonl.md
│       ├── 003-sequential-execution.md
│       ├── 004-llm-as-judge.md
│       └── 005-monorepo-layout.md
├── apps/
│   └── docs/              ← VitePress documentation site
├── packages/
│   └── agent-eval/        ← Core framework (agent-eval)
│       ├── src/
│       │   ├── core/      ← Core modules
│       │   │   ├── types.ts       ← All TypeScript interfaces
│       │   │   ├── config.ts      ← Config file loader (jiti)
│       │   │   ├── config.test.ts
│       │   │   ├── context.ts     ← TestContext (storeDiff, runCommand)
│       │   │   ├── context.test.ts
│       │   │   ├── runner.ts      ← Sequential test execution engine
│       │   │   ├── runner.test.ts
│       │   │   ├── expect.ts      ← Fluent assertion API
│       │   │   └── index.test.ts  ← test() registration tests
│       │   ├── git/       ← Git isolation
│       │   │   ├── git.ts         ← reset --hard, clean -fd, diff
│       │   │   └── git.test.ts
│       │   ├── judge/     ← LLM-as-a-Judge
│       │   │   └── judge.ts       ← Vercel AI SDK + Zod structured output
│       │   ├── ledger/    ← SQLite result storage
│       │   │   ├── ledger.ts      ← node:sqlite DatabaseSync
│       │   │   └── ledger.test.ts
│       │   ├── cli/       ← CLI binary
│       │   │   └── cli.ts         ← agenteval run|ledger|ui
│       │   └── index.ts   ← Public API (test, expect, defineConfig)
│       ├── tsup.config.ts ← Build config (ESM + CJS + DTS)
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

# Lint the codebase (ESLint)
pnpm lint

# Auto-fix lint issues
pnpm lint:fix

# Format the codebase (Prettier)
pnpm format

# Check formatting without writing
pnpm format:check

# Run the docs site locally
pnpm dev

# Type-check the core package
pnpm --filter agent-eval typecheck
```

---

## ✅ Mandatory Workflow: Lint → Format → Test → Build → Commit

**Every change MUST follow this workflow. No exceptions.**

> 💡 The Husky pre-commit hook enforces this automatically — `lint-staged` (ESLint + Prettier on staged files), `pnpm test`, and `pnpm build` all run before every commit. If any step fails, the commit is rejected.

### 1. Lint and format

```bash
pnpm lint:fix && pnpm format
```

All ESLint rules must pass. All files must be Prettier-formatted.

### 2. Run tests

```bash
pnpm test
```

All tests must pass. If a test fails, fix it before proceeding.

### 3. Run the build

```bash
pnpm build
```

Build must succeed with zero errors.

### 4. Commit when green

Once lint + format + tests + build all succeed, **commit immediately**:

```bash
git add -A
git commit -m "<type>(<scope>): <description>"
```

### Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

| Type       | When                                    |
| ---------- | --------------------------------------- |
| `feat`     | New feature or capability               |
| `fix`      | Bug fix                                 |
| `test`     | Adding or updating tests                |
| `refactor` | Code change that neither fixes nor adds |
| `docs`     | Documentation only                      |
| `chore`    | Build config, deps, tooling             |

Examples:

```bash
git commit -m "feat(runner): add timeout support for agent execution"
git commit -m "fix(ledger): handle corrupted SQLite database gracefully"
git commit -m "test(context): add unit tests for storeDiff and runCommand"
git commit -m "docs(readme): add quick start guide"
```

### ⚠️ Rules

- **ALL 4 gates must pass before committing:** lint ✅ → format ✅ → test ✅ → build ✅
- **Husky enforces this automatically.** The pre-commit hook runs `lint-staged` (ESLint + Prettier on staged files), `pnpm test`, and `pnpm build`. A failure at any step blocks the commit.
- **NEVER leave working code uncommitted.** If it passes all gates, commit it.
- **NEVER commit broken code.** Never use `--no-verify` to bypass the hook.
- **Commit frequently.** Small, focused commits are better than large ones.
- **Write tests for every new feature or bug fix.**
- **If you're unsure whether to commit, commit.** You can always amend or squash later.

### Testing Guidelines

- Tests use **Vitest** and are **colocated** next to the source file they test
- Name test files `<module>.test.ts` (e.g., `ledger/ledger.test.ts`, `core/context.test.ts`)
- Colocated means: `src/git/git.ts` → `src/git/git.test.ts` (same folder)
- Use `describe` / `it` blocks with clear descriptions
- Mock external dependencies (git commands, LLM APIs) — don't make real API calls in tests
- Test edge cases: empty inputs, missing files, malformed data

---

## 🏗️ Architecture

> **See `docs/adrs/` for full Architecture Decision Records explaining each choice.**

### Sequential Execution ([ADR-003](docs/adrs/003-sequential-execution.md))

All tests run **sequentially** (no concurrency). This is intentional – agents mutate the filesystem and Git state, so parallel execution would cause conflicts. The runner uses `for...of` loops.

### Git Isolation

Before each test iteration, the runner executes `git reset --hard HEAD && git clean -fd`. This guarantees a pristine working directory. **Never** skip git reset between test runs.

### LLM-as-a-Judge ([ADR-004](docs/adrs/004-llm-as-judge.md))

The judge module uses the Vercel AI SDK (`ai` package) with structured output (`generateObject` + Zod schema) to guarantee the judge returns `{ pass, score, reason }`. The judge prompt includes the git diff and all command outputs from the test context.

### SQLite Ledger ([ADR-002](docs/adrs/002-sqlite-over-jsonl.md))

All results are stored in `.agenteval/ledger.db` using Node 22's built-in `node:sqlite` (DatabaseSync). This provides:

- Zero external dependencies
- SQL-powered aggregations (getRunnerStats, getLatestEntries)
- Indexed queries on `test_id` and `timestamp`
- **Note:** Requires Node.js 22+. The `node:sqlite` module is experimental and produces `ExperimentalWarning`.

### API-Based Runners

Runners can be `type: "cli"` (spawn a CLI command) or `type: "api"` (call an LLM directly). API runners:

- Use Vercel AI SDK `generateObject()` with a Zod schema
- Support providers: `anthropic`, `openai`, `ollama`
- Output structured `files[]` array with `{ path, content }` written to disk
- Dynamic provider import (unused providers are never bundled)

---

## 📝 Coding Conventions

### TypeScript

- **Strict mode** enabled. No `any` types.
- Use **explicit return types** on exported functions.
- All types live in `core/types.ts` – import from there.
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

1. Add the provider type to `JudgeConfig.provider` in `core/types.ts`
2. Add a new `case` in `resolveModel()` in `judge/judge.ts`
3. Install the AI SDK provider package if needed
4. Add docs in `docs/guide/judges.md`

### Adding a new Agent runner provider

1. Add the provider type to `AgentRunnerConfig.api.provider` in `core/types.ts`
2. Add a new `case` in `resolveRunnerModel()` in `core/runner.ts`
3. Install the AI SDK provider package if needed
4. Add tests in `core/runner.test.ts`

### Adding a new CLI command

1. Add the command in `cli/cli.ts` using `program.command()`
2. Update the docs in `docs/guide/cli.md`

### Adding a new Context utility

1. Add the method signature to `TestContext` interface in `core/types.ts`
2. Implement in `EvalContext` class in `core/context.ts`
3. Add tests in `core/context.test.ts`
4. Update docs in `docs/api/context.md`

### Modifying the Ledger schema

1. Update `LedgerEntry` in `core/types.ts`
2. Update SQLite table schema in `ledger/ledger.ts` (add column with DEFAULT for backward compat)
3. Update `appendLedgerEntry` and query functions
4. Update tests in `ledger/ledger.test.ts`

---

## ⚠️ Common Pitfalls

1. **Don't use `execSync` with `stdio: "inherit"` in context.runCommand** – we need to capture stdout/stderr.
2. **Don't run tests in parallel** – Git state will be corrupted.
3. **Always use `encoding: "utf-8"`** when capturing exec output.
4. **Don't forget `.js` extensions** in ESM imports.
5. **The judge prompt is critical** – changes to `buildJudgePrompt()` in `judge/judge.ts` affect all evaluations.
6. **Node 22 required** – `node:sqlite` (DatabaseSync) is only available in Node 22+.
7. **`@ts-expect-error`** is needed on `import { DatabaseSync } from "node:sqlite"` (no stable types yet).
8. **API runner providers are dynamically imported** – ensure the SDK package is installed before using a provider.

---

## 🔮 Roadmap (from PRD)

- [x] **Phase 1**: Core runner, config, test/expect API, CLI, JSONL ledger
- [x] **Phase 2a**: SQLite ledger migration (node:sqlite), ADRs
- [x] **Phase 2b**: API-based agent runners (anthropic, openai, ollama)
- [x] **Phase 2c**: CI/CD pipeline (GitHub Actions)
- [ ] **Phase 3**: E2E integration test with dummy target app
- [ ] **Phase 4**: Visual dashboard (`apps/eval-ui` with React + Recharts)
- [ ] **Future**: Benchmark suites, plugin system, remote execution
