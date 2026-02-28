# ROADMAP.md – AgentEval Implementation Roadmap

This file tracks the implementation progress of the AgentEval framework. It is updated step by step as features are completed.

---

## Phase 1 — Core Framework

- [x] Project scaffolding (pnpm monorepo, `packages/agent-eval`)
- [x] `core/types.ts` — All TypeScript interfaces (`AgentEvalConfig`, `TestContext`, `JudgeResult`, `LedgerEntry`, etc.)
- [x] `core/config.ts` — Config file loader via jiti (runtime TypeScript support)
- [x] `defineConfig()` — Type-safe config helper
- [x] `core/context.ts` — `EvalContext` class (`storeDiff()`, `runCommand()`, `diff`, `commands`, `logs`)
- [x] `core/runner.ts` — Sequential test execution engine (no concurrency)
- [x] `core/expect.ts` — Fluent assertion API (`expect(ctx).toPassJudge()`)
- [x] `test()` / `test.tagged()` / `test.skip()` — Test registration API
- [x] `git/git.ts` — Git isolation (`gitResetHard`, `gitDiff`, `gitCurrentBranch`, `gitHeadSha`)
- [x] `judge/judge.ts` — LLM-as-a-Judge with Vercel AI SDK + Zod structured output
- [x] `ledger/ledger.ts` — JSONL-based result storage (initial implementation)
- [x] `cli/cli.ts` — CLI binary (`agenteval run`, `agenteval ledger`)
- [x] `index.ts` — Public API surface (`test`, `expect`, `defineConfig`)

## Phase 2a — SQLite Ledger Migration

- [x] Migrate ledger from JSONL to SQLite (`node:sqlite` DatabaseSync)
- [x] Schema: `id`, `test_id`, `timestamp`, `agent_runner`, `judge_model`, `score`, `pass`, `reason`, `improvement`, `diff`, `commands`, `duration_ms`
- [x] Indexed queries on `test_id` and `timestamp`
- [x] `appendLedgerEntry()` — Insert evaluation result
- [x] `readLedger()` — Retrieve all entries
- [x] `readLedgerByTestId()` — Filter by test
- [x] `getTestIds()` — List unique test IDs
- [x] `getLatestEntries()` — Latest entries
- [x] `getRunnerStats()` / `getAllRunnerStats()` — Aggregation queries
- [x] Architecture Decision Records (ADRs):
  - [x] ADR-001: Why a custom framework (not Vitest/Promptfoo/Langfuse)
  - [x] ADR-002: SQLite over JSONL for the ledger
  - [x] ADR-003: Sequential execution (no parallelism)
  - [x] ADR-004: LLM-as-a-Judge with Vercel AI SDK
  - [x] ADR-005: Monorepo layout (apps/ + packages/)
  - [x] ADR-006: Code quality gates (ESLint + Prettier + Husky)
  - [x] ADR-007: SOLID architecture principles

## Phase 2b — API-Based Agent Runners

- [x] `type: "api"` runner support in `AgentRunnerConfig`
- [x] `resolveRunnerModel()` — Dynamic provider resolution
- [x] Anthropic provider (`@ai-sdk/anthropic`)
- [x] OpenAI provider (`@ai-sdk/openai`)
- [x] Ollama provider (OpenAI-compatible via `@ai-sdk/openai`)
- [x] Structured output: `generateObject()` with Zod schema → `files[]` array
- [x] Dynamic provider import (unused providers never bundled)
- [x] Custom `baseURL` and `apiKey` support per provider

## Phase 2c — CI/CD Pipeline

- [x] GitHub Actions workflow (`.github/workflows/ci.yml`)
- [x] Triggers: push to main, pull requests to main
- [x] Node.js 22 matrix
- [x] Steps: install → test → build → typecheck

## Phase 3 — Quality Gates & E2E

- [x] Husky pre-commit hook (lint-staged → test → build)
- [x] ESLint configuration (TypeScript + React Hooks)
- [x] Prettier configuration
- [x] lint-staged (ESLint + Prettier on staged files)
- [x] `apps/example-target-app/` — E2E target app
- [x] Example eval configs:
  - [x] `cli-mock/` — Mock agent (offline, no API keys)
  - [x] `cli-copilot/` — GitHub Copilot CLI
  - [x] `cli-claude/` — Claude Code CLI
  - [x] `cli-aider/` — Aider CLI
  - [x] `cli-judge/` — CLI-based judge
  - [x] `api-openai/` — OpenAI GPT-4o API runner
  - [x] `api-anthropic/` — Anthropic Claude API runner
  - [x] `api-ollama/` — Ollama local model API runner
- [x] npm scripts per eval config (`pnpm eval:mock`, `pnpm eval:copilot`, etc.)

## Phase 4 — Visual Dashboard

- [x] `apps/eval-ui/` — React 19 + Tailwind CSS + Recharts
- [x] `agenteval ui` / `agenteval view` CLI command (Express API server)
- [x] API endpoints: `/api/runs`, `/api/tests`, `/api/stats`
- [x] Pages:
  - [x] Overview — Aggregate stats, score distribution chart, recent runs
  - [x] Runs — Filterable/sortable runs table
  - [x] EvalDetail — Per-evaluation breakdown, score-over-time chart, runner comparison
- [x] Components:
  - [x] Sidebar — Navigation + evaluation filter + connection status
  - [x] RunsTable — Sortable table with status badges
  - [x] RunDetailPanel — Full run details (score, reasoning, improvement, diff, commands)
  - [x] DiffViewer — GitHub-style syntax-highlighted diff viewer (collapsible files)
  - [x] ScoreRing — Circular progress indicator
- [x] Seed data script (`npx tsx src/seed.ts`)
- [x] Semantic theming with CSS variables
- [x] React Router v7 navigation

## Phase 5 — Comprehensive Testing

- [x] Core package unit tests (94 tests):
  - [x] `core/config.test.ts`
  - [x] `core/context.test.ts`
  - [x] `core/runner.test.ts`
  - [x] `core/expect.test.ts`
  - [x] `core/index.test.ts`
  - [x] `git/git.test.ts`
  - [x] `judge/judge.test.ts`
  - [x] `ledger/ledger.test.ts`
- [x] Dashboard component tests (102 tests):
  - [x] `components/Sidebar.test.tsx`
  - [x] `components/DiffViewer.test.tsx`
  - [x] `components/RunDetailPanel.test.tsx`
  - [x] `components/RunsTable.test.tsx`
  - [x] `pages/Overview.test.tsx`
  - [x] `pages/Runs.test.tsx`
  - [x] `pages/EvalDetail.test.tsx`
  - [x] `lib/api.test.ts`
- [x] Test helpers: `renderWithRouter()`, `renderPage()`, mock data factories
- [x] Coverage thresholds: ≥ 95% statements, ≥ 85% branches, ≥ 95% functions

## Phase 6 — Documentation

- [x] VitePress site (`apps/docs/`)
- [x] Guide pages:
  - [x] Getting Started — Installation, quick start, first eval
  - [x] Configuration — Full config walkthrough, afterEach hooks, env vars
  - [x] Writing Tests — Test lifecycle, expectedFiles, error handling
  - [x] Runners — CLI vs API, all provider examples, error handling
  - [x] Judges — All providers, scoring, expectedFiles scope analysis, CLI judge
  - [x] Dashboard — UI features, architecture, seed data
  - [x] CLI Reference — All commands, options, troubleshooting
  - [x] Architecture — SOLID principles, monorepo layout, data flow diagrams
  - [x] Contributing — Workflow, testing guidelines, local dev setup
- [x] API Reference pages:
  - [x] `test()` — Registration, variants, execution flow
  - [x] `expect()` — JudgeOptions, JudgeResult, expectedFiles, behavior flow
  - [x] `TestContext` — Lifecycle, auto storeDiff, runCommand, properties
  - [x] `defineConfig()` — Full type definitions, all config options
  - [x] Ledger — Schema, ER diagram, query functions, programmatic API
- [x] Mermaid diagrams across all doc pages (flowcharts, sequence diagrams, ER diagrams)
- [x] `AGENTS.md` — AI agent development guide with:
  - [x] Mandatory documentation update rules
  - [x] Code → documentation cross-reference map (Mermaid)
  - [x] Mermaid diagram guidelines
  - [x] Testing guidelines (core + eval-ui)
  - [x] Feature addition checklists
- [x] `README.md` — Project overview, quick start, CLI reference, architecture

## Phase 7 — Advanced Features (Implemented)

- [x] `afterEach` commands — Auto-run tests/builds after each agent execution
- [x] Auto `storeDiff()` — Called automatically after `agent.run()`
- [x] `expectedFiles` — Scope analysis to detect agents modifying unexpected files
- [x] `improvement` field — Judge returns actionable suggestions alongside scores
- [x] CLI judge support — Any CLI tool as judge (`{{prompt}}`, `{{prompt_file}}`)
- [x] `maxRetries` — Retry on invalid JSON from CLI judges
- [x] `agent.name` / `agent.model` — Accessible properties on agent handle
- [x] `test.tagged()` — Tag-based test filtering (`agenteval run -t ui`)
- [x] `test.skip()` — Skip tests without removing them
- [x] Model matrix — `matrix.runners` to filter which runners execute
- [x] Per-test model override — Override judge model in `toPassJudge()`

## Phase 8 — Test Suites & Hierarchical Dashboard (`describe`)

- [x] **Core API (`core/index.ts`)**
  - [x] Implement and export the `describe(name, fn)` function
  - [x] Handle nested scoping context to allow `describe` blocks inside `describe` blocks
  - [x] Update test registration to capture the full namespace path (e.g., `['UI Components', 'Banner']`)
  - [x] Add `suitePath?: string[]` to `TestDefinition` and `LedgerEntry` types

- [x] **Ledger & Database (`ledger/ledger.ts`)**
  - [x] Update SQLite schema — added `suite_path TEXT NOT NULL DEFAULT '[]'` column
  - [x] Backward compatibility with migration for older databases
  - [x] `getTestTree()` function — builds hierarchical tree structure from flat suite paths
  - [x] Updated `appendLedgerEntry` and `rowToEntry` for suite_path JSON serialization

- [x] **Visual Dashboard (`apps/eval-ui`)**
  - [x] New `/api/tree` endpoint returns hierarchical `TestTreeNode[]` structure
  - [x] **Sidebar:** Collapsible tree view with suite folders and test leaves
  - [x] **Breadcrumbs:** Suite path segments shown in EvalDetail breadcrumb navigation
  - [x] Updated seed data with suite paths for testing

- [x] **Tests**
  - [x] 9 new `describe()` tests (nested scoping, error recovery, tagged tests inside suites)
  - [x] 3 new ledger tests (suitePath storage, getTestTree hierarchy)
  - [x] Updated Sidebar tests for tree view (collapse/expand, suite nodes, test links)
  - [x] New `fetchTestTree` API tests
  - [x] Updated EvalDetail tests for breadcrumb suite paths

- [x] **Documentation (`apps/docs`)**
  - [x] `describe()` API reference in `api/test.md` with Mermaid diagram
  - [x] "Grouping Tests with describe()" section in `guide/writing-tests.md`
  - [x] Updated ER diagrams in `architecture.md` and `ledger.md` with `suite_path`
  - [x] Suite tree navigation docs in `guide/dashboard.md`
  - [x] Updated CLI and ledger API endpoint tables with `/api/tree`

## Phase 9 — Human-in-the-Loop (HITL) Score Overrides

- [ ] **Database & Ledger (`ledger/ledger.ts`)**
  - [ ] Update SQLite schema to support audit trails (e.g., create a `score_overrides` table linked to `runs`, or add `manual_score`, `override_reason`, and `override_timestamp` columns to the `runs` table)
  - [ ] Implement `overrideRunScore(runId, newScore, reason)` function
  - [ ] Ensure the original LLM-generated score and reasoning are strictly preserved and never overwritten
  - [ ] Update aggregation queries to prioritize the manual score over the LLM score in the overall stats

- [ ] **API & Backend (`cli/server.ts`)**
  - [ ] Add `PATCH /api/runs/:id/override` endpoint to handle score adjustment requests
  - [ ] Implement strict validation (ensure the new score is between 0.0 and 1.0, and that the `reason` string is not empty)
  - [ ] Add `GET /api/runs/:id/history` endpoint to fetch the audit trail of a specific run

- [ ] **Visual Dashboard (`apps/eval-ui`)**
  - [ ] **RunDetailPanel:** Add an "Edit Score" action button next to the current LLM score
  - [ ] **Override Modal:** Create a form component requiring the user to input the new score and a mandatory text area for the justification
  - [ ] **Audit Trail View:** Add a "History" or "Changelog" section in the run details, displaying the original LLM score and a chronological list of all human adjustments
  - [ ] **Visual Indicators:** Add a "Manually Adjusted" badge or icon in the `RunsTable` to easily identify evaluations that were corrected by a human

- [ ] **Documentation (`apps/docs`)**
  - [ ] Document the Human-in-the-Loop (HITL) workflow and the importance of tracking LLM mistakes
  - [ ] Update the SQLite ER (Entity-Relationship) diagram to include the new override/history tables

## Phase 10 — Custom Scoring Thresholds (Warn / Error)

- [ ] **Core API (`core/index.ts` & `core/expect.ts`)**
  - [ ] Extend test configuration or `toPassJudge()` options to accept `thresholds: { warn: number, fail: number }`
  - [ ] Implement logic to compute the final test status (`PASS`, `WARN`, `FAIL`) based on the LLM's raw score and the custom thresholds
  - [ ] Allow setting global default thresholds in `agenteval.config.ts`

- [ ] **Database & Ledger (`ledger/ledger.ts`)**
  - [ ] Update SQLite schema: migrate the boolean `pass` column to a `status` enum (`'PASS' | 'WARN' | 'FAIL'`)
  - [ ] Store the applied `warn_threshold` and `fail_threshold` in the `runs` table to preserve historical context (if thresholds change in the codebase later, old runs remain accurate)

- [ ] **Visual Dashboard (`apps/eval-ui`)**
  - [ ] **Status Badges:** Introduce a yellow/orange "Warning" badge across the UI (RunsTable, Overview)
  - [ ] **Score Gauge:** Update the circular `ScoreRing` component to visually indicate the threshold markers (e.g., red zone, yellow zone, green zone) based on the test's specific config
  - [ ] **Metrics:** Include "Warnings" in the aggregate statistics (e.g., "Pass Rate" vs "Warn Rate")

- [ ] **Documentation (`apps/docs`)**
  - [ ] Add a guide on "Fuzzy Evaluation & Thresholds" explaining how to handle non-binary LLM scores
  - [ ] Update API references for `test()`, `expect()`, and the configuration object

## Phase 11 — Dynamic CLI Reporter & Summary Table

- [ ] **CLI & UI Engine (`cli/reporter.ts`)**
  - [ ] Integrate a terminal UI library (e.g., `ora`, `@clack/prompts`, or `picocolors`) to handle dynamic console output
  - [ ] Implement real-time test progress indicators (spinners for running tests, `✓` for PASS, `⚠` for WARN, `✗` for FAIL)
  - [ ] Build a final summary table output (displaying Test ID, Agent Model, Score, Status, and Duration) at the end of the execution suite
  - [ ] Add support for CLI verbosity flags (e.g., `--silent` for CI environments, `--verbose` for detailed execution logs)

- [ ] **Core Runner Integration (`core/runner.ts`)**
  - [ ] Refactor the runner loop to decouple execution logic from standard `console.log` outputs (emit events or use a Reporter interface)
  - [ ] Track precise execution time per test (and per agent runner) to feed the summary table
  - [ ] Gracefully handle multi-line error outputs and LLM reasoning directly in the terminal without breaking the layout

- [ ] **Documentation (`apps/docs`)**
  - [ ] Update the CLI Reference page with examples of the new terminal output
  - [ ] Document the new CLI flags (`--silent`, `--reporter`, etc.)

---

## Future — Planned

- [ ] Benchmark suites — Curated evaluation sets for common tasks (React components, API endpoints, refactoring)
- [ ] Plugin system — Custom runners and judges as installable packages
- [ ] Remote execution — Cloud-based agent execution and evaluation
- [ ] Parallel evaluation — Safe concurrent execution with workspace isolation
- [ ] Dashboard improvements — Live reload, comparison views, export to PDF/CSV
- [ ] Notification hooks — Webhooks/Slack alerts on score regressions
- [ ] Multi-repo support — Evaluate agents across multiple project repositories
- [ ] Cost tracking — Track API costs per run (tokens, latency, pricing)
- [ ] A/B testing — Statistical significance testing between runner versions
- [ ] Custom scorers — User-defined scoring functions (beyond LLM judge)
