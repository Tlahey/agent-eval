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

## Phase 9 — Human-in-the-Loop (HITL) Score Overrides ✅

- [x] **Database & Ledger (`ledger/ledger.ts`)**
  - [x] Created `score_overrides` table (run_id, score, pass, reason, timestamp) with FK to runs
  - [x] Implemented `overrideRunScore(outputDir, runId, newScore, reason)` with validation
  - [x] Implemented `getRunOverrides(outputDir, runId)` for audit trail (newest first)
  - [x] Original LLM score preserved — overrides stored in separate table
  - [x] Updated all aggregation queries (`getRunnerStats`, `getAllRunnerStats`) to use `COALESCE` with latest override
  - [x] Updated `readLedger`, `readLedgerByTestId`, `getLatestEntries` to include `override` field via LEFT JOIN

- [x] **API & Backend (`cli/cli.ts`)**
  - [x] Added `PATCH /api/runs/:id/override` endpoint with body validation (score 0-1, non-empty reason)
  - [x] Added `GET /api/runs/:id/overrides` endpoint for audit trail
  - [x] Added CORS support for PATCH method + OPTIONS preflight handling
  - [x] Added request body parsing for the raw `node:http` server

- [x] **Types (`core/types.ts`)**
  - [x] Added `ScoreOverride` interface (score, pass, reason, timestamp)
  - [x] Added `override?: ScoreOverride` to `LedgerEntry`
  - [x] Exported `ScoreOverride` from public API

- [x] **Visual Dashboard (`apps/eval-ui`)**
  - [x] **OverrideScoreModal**: New component with score slider (0–1), required reason textarea, Original→New score preview
  - [x] **RunDetailPanel**: Added pencil "Edit Score" button, override modal integration, "Adjusted" badge, History tab with audit trail
  - [x] **RunsTable**: Shows "Adjusted" badge and uses override score for display when present
  - [x] **API client**: Added `overrideScore()` and `fetchOverrides()` functions, `ScoreOverride` type

- [x] **Tests (29 new tests)**
  - [x] 9 ledger tests: overrideRunScore validation, getRunOverrides audit trail, readLedger with overrides, aggregation with overrides
  - [x] 7 API client tests: overrideScore PATCH, fetchOverrides GET, error handling
  - [x] 7 OverrideScoreModal tests: rendering, validation, submit, cancel, backdrop click
  - [x] 6 RunDetailPanel tests: Adjusted badge, override score display, edit button, modal open, History tab
  - [x] 3 RunsTable tests: Adjusted badge, override score in ScoreRing, no badge without override

- [x] **Documentation**
  - [x] Updated `api/ledger.md`: override endpoints, score_overrides table schema, ER diagram, HITL sequence diagram, programmatic API
  - [x] Updated `guide/architecture.md`: ER diagram with score_overrides table
  - [x] Updated `guide/cli.md`: new endpoint table with PATCH and GET override endpoints
  - [x] Updated `guide/dashboard.md`: HITL workflow guide with Mermaid diagram, override behaviors
  - [x] Updated seed script with score_overrides table and ~15% override seeding

## Phase 10 — Custom Scoring Thresholds (Warn / Error) ✅

- [x] **Core API (`core/types.ts`, `core/expect.ts`)**
  - [x] Add `TestStatus` type (`"PASS" | "WARN" | "FAIL"`), `Thresholds` interface, `DEFAULT_THRESHOLDS` constant, `computeStatus()` function
  - [x] Extend `toPassJudge()` options to accept `thresholds: { warn: number, fail: number }`
  - [x] Compute final test status from score + thresholds (per-test → global → defaults)
  - [x] Allow global default thresholds in `agenteval.config.ts` via `setGlobalThresholds()`
  - [x] WARN does not throw; only FAIL throws `JudgeFailure`

- [x] **Database & Ledger (`ledger/ledger.ts`)**
  - [x] Add `status`, `warn_threshold`, `fail_threshold` columns with migrations
  - [x] Store applied thresholds per run for historical accuracy
  - [x] Update `overrideRunScore` to compute status from stored thresholds
  - [x] Backward compatible: `rowToEntry()` recomputes status from score when reading old data

- [x] **Runner & Reporter (`core/runner.ts`, `core/reporter.ts`)**
  - [x] Compute thresholds per run (per-test → global → defaults) and set `entry.status`/`entry.thresholds`
  - [x] Add `onTestWarn()` to Reporter interface, all 3 implementations updated
  - [x] Summary table shows PASS/WARN/FAIL counts

- [x] **Visual Dashboard (`apps/eval-ui`)**
  - [x] `StatusBadge` component with PASS (green) / WARN (yellow) / FAIL (red) styling
  - [x] Warnings KPI card on Overview page
  - [x] 3-segment donut chart (Pass / Warn / Fail)
  - [x] RunDetailPanel shows 3-state status badge

- [x] **Seed Data & Tests**
  - [x] Updated seed script with status/thresholds columns
  - [x] 144 core tests pass (added threshold tests to expect, reporter, ledger)
  - [x] 128 UI tests pass (added WARN badge tests to RunsTable, RunDetailPanel, Overview)

- [x] **Documentation (`apps/docs`)**
  - [x] Added "Scoring Thresholds" section to configuration guide with Mermaid diagrams
  - [x] Updated `api/expect.md` with thresholds option, 3-state behavior diagram, and `TestStatus` type

## Phase 11 — Dynamic CLI Reporter & Summary Table ✅

- [x] **CLI & UI Engine (`cli/reporter.ts`)** — _Implemented in `core/reporter.ts`_
  - [x] Integrate `ora` for spinners + `chalk` for colors in terminal output
  - [x] Implement real-time test progress indicators (spinners for running tests, `✓` for PASS, `✗` for FAIL)
  - [x] Build a final summary table output (Test ID, Runner, Score, Status, Duration) at the end of the execution suite
  - [x] Add support for CLI verbosity flags (`--silent` for CI environments, `--verbose` for detailed execution logs)
  - [x] Implement `Reporter` interface with three built-in implementations: `DefaultReporter`, `SilentReporter`, `VerboseReporter`

- [x] **Core Runner Integration (`core/runner.ts`)**
  - [x] Refactor runner to accept `Reporter` parameter (dependency injection, replacing all `console.log` calls)
  - [x] Emit events through Reporter methods (`onTestStart`, `onTestPass`, `onTestFail`, `onTestError`, `onGitReset`, `onFileWrite`)
  - [x] Track precise execution time per test with `durationMs` in `TestResultEvent`
  - [x] Gracefully handle multi-line error outputs via `onTestError` and truncation helpers

- [x] **Testing**
  - [x] Unit tests for `DefaultReporter`, `SilentReporter`, `VerboseReporter` (`reporter.test.ts`, 22 tests)
  - [x] Existing runner tests continue to pass (reporter parameter is optional)
  - [x] Total: 261 tests passing (134 core + 127 UI)

- [x] **Documentation (`apps/docs`)**
  - [x] Updated CLI Reference (`guide/cli.md`) with `--silent`/`--verbose` flags, reporter modes diagram, output examples
  - [x] Exported `Reporter`, `DefaultReporter`, `SilentReporter`, `VerboseReporter` from public API

## Phase 12 — Advanced Dashboard: Real-time & Reporting

- [ ] **Local API & Real-time Engine (`cli/server.ts`)**
  - [ ] Implement Server-Sent Events (SSE) or WebSockets to broadcast database changes (`INSERT` on the `runs` table) in real-time
  - [ ] Add backend endpoints for data export (`GET /api/export/csv` and `/api/export/json`) to easily extract ledger data
  - [ ] Ensure the local server gracefully handles concurrent read/writes during live CLI test executions

- [ ] **Visual Dashboard (`apps/eval-ui`)**
  - [ ] **Live Reload:** Integrate a WebSocket/SSE client to automatically refresh the Runs Table and Analytics Graphs without page reloads while `agenteval run` is executing
  - [ ] **Comparison View:** Build a side-by-side UI allowing users to select two different runs of the same test (e.g., Copilot vs. Claude) to visually compare their Code Diffs, Execution Times, and Judge Reasoning
  - [ ] **Export & Reporting:** Add "Export to CSV" buttons on the data tables for spreadsheet analysis
  - [ ] **PDF Generation:** Implement a "Download Report" feature (using print stylesheets or libraries like `html2pdf.js`) to generate clean, management-ready PDF summaries of the test suites

- [ ] **Documentation (`apps/docs`)**
  - [ ] Document the real-time architecture and how to keep the dashboard open during CLI executions
  - [ ] Add a guide on "Generating Stakeholder Reports" explaining the PDF and CSV export features

## Phase 13 — Cost & Token Tracking (AI FinOps)

- [ ] **Core Engine & Judges (`core/runner.ts` & `judge/judge.ts`)**
  - [ ] Extract token usage (`promptTokens`, `completionTokens`, `totalTokens`) from the Vercel AI SDK responses for both the Agent Runner and the LLM Judge
  - [ ] Implement a Pricing Engine (dictionary) mapping models to their current API costs (e.g., `$3/1M input`, `$15/1M output` for Claude 3.5 Sonnet)
  - [ ] Calculate the total cost (in USD) for each execution (Agent Cost + Judge Cost)
  - [ ] Track precise API latency alongside overall execution time

- [ ] **Database & Ledger (`ledger/ledger.ts`)**
  - [ ] Update SQLite schema: add columns for `prompt_tokens`, `completion_tokens`, `total_tokens`, and `cost_usd` to the `runs` table
  - [ ] Update aggregation queries to include `SUM(cost_usd)` and average token usage across test suites and models

- [ ] **Visual Dashboard (`apps/eval-ui`)**
  - [ ] **FinOps Overview:** Add a "Total Spend" and "Cost per Run" widget to the Overview page to monitor the budget
  - [ ] **Efficiency Metrics:** Build a scatter plot chart comparing "Score vs. Cost" (to easily spot models that are cheap and effective vs. expensive and underperforming)
  - [ ] **Run Details:** Display token usage, cost, and API latency clearly inside the `RunDetailPanel`
  - [ ] **Runs Table:** Add sortable columns for `Cost` and `Tokens`

- [ ] **Documentation (`apps/docs`)**
  - [ ] Create an "AI FinOps" guide explaining how costs are calculated and how to configure custom pricing for proprietary/internal models
  - [ ] Document best practices for reducing token usage in agent prompts

## Phase 14 — Custom Programmatic Scorers (Deterministic Evaluation)

- [ ] **Core API (`core/expect.ts` & `core/scorers/`)**
  - [ ] Extend the assertion API to support custom scoring functions: `expect(ctx).toPassScorer(myCustomScorer)`
  - [ ] Define the `Scorer` interface: a function taking the `EvalContext` and returning `{ pass: boolean, score: number, reason: string }`
  - [ ] Implement built-in deterministic scorers out-of-the-box (e.g., `RegexScorer`, `ASTScorer`, `TestCoverageScorer`, `BundleSizeScorer`)
  - [ ] Allow composite/hybrid scoring (e.g., combining an LLM Judge score with a deterministic Test Coverage score via weighted averages)

- [ ] **Database & Ledger (`ledger/ledger.ts`)**
  - [ ] Update SQLite schema to track the _type_ of judge/scorer used for the run (e.g., `scorer_type: 'llm' | 'custom' | 'hybrid'`)
  - [ ] Store specific metrics emitted by custom scorers (e.g., exact test coverage percentage) alongside the final 0.0-1.0 score

- [ ] **Visual Dashboard (`apps/eval-ui`)**
  - [ ] **Run Details:** Clearly display whether the score was generated by an LLM (showing token usage) or by a deterministic Custom Scorer (showing the execution logic/metrics)
  - [ ] **Metrics:** Allow filtering the Runs Table and Analytics Graphs by scorer type (e.g., "Show me only runs evaluated by the AST Scorer")

- [ ] **Documentation (`apps/docs`)**
  - [ ] Create a "Custom Scorers" guide demonstrating how developers can write their own deterministic evaluation functions
  - [ ] Document the built-in programmatic scorers and how they save time and API costs compared to LLM Judges

## Phase 15 — Dockerized Execution (Sandboxed Environments)

- [ ] **Core Engine & Sandbox (`core/runner.ts` & `core/sandbox/`)**
  - [ ] Integrate Docker support (via Docker CLI wrapper or `dockerode`) to manage ephemeral container lifecycles (Spin up → Run Agent → Extract Diff → Tear down)
  - [ ] Implement workspace mounting strategies (copying the target repo into the container rather than mutating the host file system)
  - [ ] Unlock **Parallel Execution**: Allow running multiple evaluation scenarios concurrently since each agent now operates in its own isolated container
  - [ ] Support custom base images in `agenteval.config.ts` (e.g., `image: 'node:22-alpine'` or custom internal images pre-loaded with dependencies)

- [ ] **Security & Context (`core/context.ts`)**
  - [ ] Enforce hard timeouts at the container level to strictly kill runaway agents (e.g., infinite `while` loops generated by the LLM)
  - [ ] Implement network isolation options (preventing the agent from making unauthorized HTTP requests, except to allowed LLM provider IPs)

- [ ] **Database & Ledger (`ledger/ledger.ts`)**
  - [ ] Update SQLite schema to track execution environment details (e.g., `environment: 'local' | 'docker'`, `docker_image`)
  - [ ] Log container setup time versus actual agent execution time

- [ ] **Visual Dashboard (`apps/eval-ui`)**
  - [ ] **Run Details:** Add a "Sandboxed" badge and display the specific Docker image/environment variables used for the evaluation
  - [ ] **Performance Metrics:** Differentiate container boot time from agent reasoning time in the execution charts

- [ ] **Documentation (`apps/docs`)**
  - [ ] Create a "Sandboxing & Security" guide explaining how to safely evaluate untrusted AI-generated code
  - [ ] Document how to optimize Dockerfiles for faster eval setups (e.g., caching `node_modules` in the base image)

## Phase 16 — A/B Testing & Statistical Significance

- [ ] **Math & Analytics Engine (`core/analytics/`)**
  - [ ] Implement statistical tests (e.g., Welch's t-test or Mann-Whitney U test) to compare the performance distributions of two runners or prompts
  - [ ] Calculate p-values and Confidence Intervals (e.g., 95% CI) to mathematically prove if a score difference is statistically significant or just random LLM variance
  - [ ] Enable A/B testing configuration directly in the runner (e.g., automatically running the same test 10 times to build a statistically viable sample size)

- [ ] **Database & Ledger (`ledger/ledger.ts`)**
  - [ ] Update SQLite schema to track "Experiment IDs" or "Prompt Versions" to group runs for accurate A/B comparison

- [ ] **Visual Dashboard (`apps/eval-ui`)**
  - [ ] **A/B Test View:** Create a dedicated interface where users select a Baseline (Control) and a Challenger (Variant) to generate a comparison report
  - [ ] **Confidence Intervals:** Display error bars or shaded variance zones on the Recharts line charts
  - [ ] **Winner Declaration:** Automatically display a "Statistically Significant Winner" badge (or declare a "Statistical Tie") with plain-English explanations of the math

- [ ] **Documentation (`apps/docs`)**
  - [ ] Create an "A/B Testing & Math" guide explaining concepts like p-value and sample size to developers in an accessible way

## Phase 17 — Extensibility & Plugin Ecosystem

- [ ] **Core Plugin Architecture (`core/plugin.ts`)**
  - [ ] Define a strict `Plugin` interface exposing hooks for the evaluation lifecycle (e.g., `onSetup`, `onAgentRun`, `onEvaluate`, `onTeardown`)
  - [ ] Implement a dynamic module loader in the configuration engine to support external npm packages (e.g., `plugins: [require('@agenteval/plugin-bedrock')]`)
  - [ ] Expose an API for plugins to register custom Agent Runners and custom LLM Judges seamlessly

- [ ] **Config & Validation (`core/config.ts`)**
  - [ ] Update `agenteval.config.ts` schema to accept the `plugins` array
  - [ ] Add namespace collision detection to ensure a plugin doesn't accidentally overwrite a core runner (e.g., reserving the `core:` prefix)

- [ ] **Ledger & Database (`ledger/ledger.ts`)**
  - [ ] Update SQLite schema to allow plugins to store custom metadata (e.g., a `plugin_metadata` JSON column in the `runs` table)

- [ ] **Visual Dashboard (`apps/eval-ui`)**
  - [ ] **Plugin Registry View:** Display active plugins and their versions in the dashboard settings
  - [ ] **Custom UI Injections:** Provide a safe way for plugins to render custom data or specific metrics inside the `RunDetailPanel`

- [ ] **Documentation (`apps/docs`)**
  - [ ] Write a comprehensive "Authoring Plugins" guide with boilerplate code to help the community build their own runners and judges
  - [ ] Document the lifecycle hooks available to plugin developers

## Phase 18 — Automated Releases & Documentation Deployment

- [x] **Versioning & NPM Publishing (`.github/workflows/release.yml`)**
  - [x] Integrate a version management tool (e.g., `Changesets` or `Semantic Release`) to handle semantic versioning (semver) automatically based on commit messages or PR labels
  - [x] Create a GitHub Action workflow to build the package (`pnpm build`) and securely publish to the npm registry (`npm publish --provenance`) on version tags
  - [x] Automatically generate and update the `CHANGELOG.md` file and create GitHub Releases with attached release notes

- [x] **Documentation Sync (GitHub Wiki & Pages)**
  - [x] ~~GitHub Wiki Sync~~ — Skipped in favor of VitePress-only docs
  - [x] **GitHub Pages (VitePress):** Set up a workflow (`.github/workflows/docs.yml`) to build the VitePress site and deploy the interactive HTML version to GitHub Pages for a premium reading experience
  - [x] Ensure links between the core README, the NPM package page, the Wiki, and the VitePress site are always synchronized

- [x] **Monorepo Scripts & Tooling**
  - [x] Add `pnpm run release` scripts to the root `package.json` to streamline the local version bumping and tagging process
  - [x] Ensure the `apps/eval-ui` static assets are properly bundled and distributed within the CLI package before the NPM release

## Phase 19 — SOLID Plugin Architecture (Ledger & LLM)

- [x] **Core Interfaces & Contracts (`core/interfaces.ts`)**
  - [x] Define the `ILedgerPlugin` interface (contracts for `initialize()`, `recordRun()`, `getRuns()`, `getRunById()`, `getStats()`, `overrideRunScore()`, `getRunOverrides()`, `getTestTree()`, `getTestIds()`, `getLatestEntries()`, `close()`)
  - [x] Define the `ILLMPlugin` interface (contracts for `evaluate()`, `generate()`)
  - [x] Define the `IJudgePlugin` interface (contracts for `judge()`)
  - [x] Define shared types: `RunnerStats`, `TestTreeNode`, `LLMEvaluationOptions`, `LLMGenerationOptions`, `AgentFileOutput`
  - [x] Refactor `Runner` to use `config.ledger.recordRun()` via injected `ILedgerPlugin` (Dependency Inversion)
  - [x] Refactor `Runner` to use `config.llm.generate()` for API runners when plugin is available
  - [x] Fix pre-existing type issues (`JudgeResult.status` made optional, `Reporter` method signatures)

- [x] **Configuration Engine (`core/types.ts`)**
  - [x] Add optional `ledger?: ILedgerPlugin` to `AgentEvalConfig`
  - [x] Add optional `llm?: ILLMPlugin` to `AgentEvalConfig`
  - [x] Backward-compatible: falls back to built-in SQLite + Vercel AI SDK when plugins not configured

- [x] **Ledger Plugins (in-package)**
  - [x] `ledger/sqlite-plugin.ts` — `SqliteLedger` wrapping existing `ledger.ts` functions (facade pattern)
  - [x] `ledger/json-plugin.ts` — `JsonLedger` using JSONL files (lightweight, no SQLite dependency)
  - [x] `ledger/json-plugin.test.ts` — 12 tests for JsonLedger

- [x] **LLM Plugins (in-package)**
  - [x] `llm/base-plugin.ts` — `BaseLLMPlugin` abstract class (shared Vercel AI SDK logic)
  - [x] `llm/anthropic-plugin.ts` — `AnthropicLLM` (extends BaseLLMPlugin, uses `@ai-sdk/anthropic`)
  - [x] `llm/openai-plugin.ts` — `OpenAILLM` (extends BaseLLMPlugin, uses `@ai-sdk/openai`)
  - [x] `llm/ollama-plugin.ts` — `OllamaLLM` (extends BaseLLMPlugin, uses OpenAI-compatible endpoint)
  - [x] `llm/llm-plugins.test.ts` — 12 tests with mocked AI SDK
  - [x] `llm/index.ts` — Barrel exports

- [x] **CLI & API Decoupling (`cli/cli.ts`)**
  - [x] `resolveLedger()` helper — uses `ILedgerPlugin` from config or falls back to built-in functions
  - [x] Ledger command refactored to use `resolveLedger()`
  - [x] Dashboard API server refactored with async `handleRequest()` supporting plugin promises
  - [x] Dashboard is now fully agnostic to storage backend

- [x] **Public API (`index.ts`)**
  - [x] Export all plugin interfaces: `ILedgerPlugin`, `ILLMPlugin`, `IJudgePlugin`, `RunnerStats`, `TestTreeNode`
  - [x] Export all plugin implementations: `SqliteLedger`, `JsonLedger`, `BaseLLMPlugin`, `AnthropicLLM`, `OpenAILLM`, `OllamaLLM`

- [x] **Tests**
  - [x] `core/interfaces.test.ts` — 6 tests for plugin contracts and types
  - [x] `ledger/json-plugin.test.ts` — 12 tests for JsonLedger
  - [x] `llm/llm-plugins.test.ts` — 12 tests for LLM plugins (mocked)
  - [x] All 302 tests passing (174 core + 128 UI)

- [x] **Documentation**
  - [x] `guide/plugin-architecture.md` — Full guide with Mermaid diagrams
  - [x] `guide/configuration.md` — Added `ledger` and `llm` plugin options
  - [x] `api/define-config.md` — Added plugin config fields
  - [x] `guide/architecture.md` — Updated extending table and structure
  - [x] `AGENTS.md` — Updated structure, doc map, feature guide, architecture section

## Phase 20 — SOLID Environment Plugins (Execution Context & Docker)

- [x] **Core Interfaces & Contracts (`core/interfaces.ts`)**
  - [x] Define `IEnvironmentPlugin` interface with lifecycle hooks: `setup()`, `execute()`, `getDiff()`, `teardown?()`
  - [x] Define `EnvironmentCommandResult` type: `{ stdout, stderr, exitCode }`
  - [x] Add `environment?: IEnvironmentPlugin` to `AgentEvalConfig` in `types.ts`
  - [x] Add `validateEnvironmentPlugin()` to `plugin-validator.ts`
  - [x] Refactor `EvalContext` to delegate operations to injected `IEnvironmentPlugin` instance
  - [x] Add `storeDiffAsync()` method for async environment plugins

- [x] **Local Git Environment Plugin (Default Fallback)**
  - [x] Create `environment/local-environment.ts` as default execution environment
  - [x] `setup()` — `git reset --hard HEAD` + `git clean -fd`
  - [x] `execute()` — native `child_process.execSync` with captured output
  - [x] `getDiff()` — staged + unstaged git diff
  - [x] Full test suite: `local-environment.test.ts`

- [x] **Docker Environment Plugin (Sandboxed)**
  - [x] Create `environment/docker-environment.ts` for isolated container execution
  - [x] `setup()` — `docker create` with volume mount + `docker start`
  - [x] `execute()` — `docker exec` inside running container
  - [x] `getDiff()` — `docker exec git diff` inside container
  - [x] `teardown()` — `docker rm -f` to remove container
  - [x] Support `Dockerfile` builds and custom `dockerArgs`
  - [x] Full test suite (mocked): `docker-environment.test.ts`

- [x] **Runner Refactor (`core/runner.ts`)**
  - [x] Replace `gitResetHard()` with `env.setup(cwd)`
  - [x] Replace CLI `execSync` with `env.execute()`
  - [x] Add `env.teardown()` in `finally` block
  - [x] Use `storeDiffAsync()` for async environment support
  - [x] Fallback to `LocalEnvironment` when no env configured
  - [x] Updated all runner tests with mock environment

- [x] **Configuration & Documentation**
  - [x] Create `guide/environments.md` with Mermaid diagrams, SSH + temp-clone examples
  - [x] Add `Environments` to VitePress sidebar
  - [x] Update `guide/plugin-architecture.md` — add IEnvironmentPlugin section and diagram
  - [x] Update `guide/configuration.md` — add `environment` to options table
  - [x] Update `api/define-config.md` — add `environment` field
  - [x] Update `guide/architecture.md` — add environment module, update extending table
  - [x] Update `AGENTS.md` — add environment plugin recipe, structure, cross-reference
  - [x] Update `ROADMAP.md`

- [ ] **Parallel Execution Readiness (Future)**
  - [ ] Add `maxWorkers` experimental config for parallel test execution
  - [ ] Pool-based runner with multiple environment instances

---

## Phase 21 — Declarative Pipeline & Single-Instruct Policy ✅

- [x] **Types**
  - [x] `TaskDefinition` interface (name, action, criteria, weight)
  - [x] `agent.instruct(prompt)` on `AgentHandle`
  - [x] `ctx.addTask()`, `ctx.exec()`, `ctx.tasks` on `TestContext`
  - [x] `HookFn`, `HookContext`, `HookDefinition` types
  - [x] `TestFn` supports sync (declarative) and async (imperative)

- [x] **Declarative Pipeline**
  - [x] `agent.instruct()` + `ctx.addTask()` registers declarative plan
  - [x] Runner auto-executes: agent → storeDiff → afterEach → tasks → auto-judge
  - [x] Weighted task scoring via `buildDeclarativeJudgePrompt()`
  - [x] Single-Instruct Policy: one `instruct()` per test, no mixing with `run()`

- [x] **Lifecycle Hooks**
  - [x] `beforeEach()` / `afterEach()` DSL with describe-scope matching
  - [x] `getMatchingHooks()` prefix-based hook filtering
  - [x] afterEach hooks run even on test failure

- [x] **Dry-Run Mode**
  - [x] `--dry-run` CLI flag
  - [x] `dryRunTest()` returns execution plan without side effects
  - [x] Formatted CLI output: mode, instruction, tasks, runners, hooks

- [x] **Tests & Documentation**
  - [x] Context tests: addTask, exec, validation, immutability
  - [x] Runner tests: declarative pipeline, single-instruct, dry-run, hooks
  - [x] Index tests: beforeEach/afterEach registration, scoping, matching
  - [x] Declarative Pipeline guide page
  - [x] Updated writing-tests, context API, test API, CLI docs

---

## Phase 22 — Modern CLI UX & Dynamic Reporter ✅

- [x] **Terminal Styling**
  - [x] Replace `chalk` and `ora` with `picocolors` (14x faster, zero dependencies)
  - [x] Non-TUI approach: no terminal clearing, all output stays in scrollback history
  - [x] Unicode symbols for pipeline steps: ✓ (done), ● (running), ✗ (error)

- [x] **Pipeline Step Visualization**
  - [x] `onPipelineStep(event, step, status, detail?)` on Reporter interface
  - [x] `PipelineStep` type: `setup | agent | diff | afterEach | task | judge`
  - [x] `StepStatus` type: `running | done | error`
  - [x] Runner emits pipeline events at each stage (declarative + setup)
  - [x] Batch progress counter `[N/M]` for matrix testing

- [x] **CI Auto-Detection**
  - [x] `isCI()` utility checking: CI, GITHUB_ACTIONS, GITLAB_CI, JENKINS_URL, CIRCLECI, BUILDKITE, TF_BUILD, CODEBUILD_BUILD_ID, !isTTY
  - [x] `CIReporter`: plain text, no colors, machine-readable output
  - [x] CLI auto-selects CIReporter when CI detected

- [x] **Reporters**
  - [x] `DefaultReporter`: non-TUI with pipeline steps, progress counter, summary table
  - [x] `VerboseReporter`: detailed pipeline steps with judge reasoning
  - [x] `SilentReporter`: no-op (unchanged)
  - [x] `CIReporter`: new, plain text for CI environments
  - [x] All reporters implement `onPipelineStep`

- [x] **Tests & Documentation**
  - [x] Reporter tests rewritten: DefaultReporter, VerboseReporter, CIReporter, isCI, onPipelineStep
  - [x] Updated CLI docs with non-TUI output examples, CI detection, custom reporter API
  - [x] Exported `CIReporter`, `isCI`, `PipelineStep`, `StepStatus` from public API

---

## Future — Planned

- [ ] Benchmark suites — Curated evaluation sets for common tasks (React components, API endpoints, refactoring)
- [ ] Remote execution — Cloud-based agent execution and evaluation
- [ ] Parallel evaluation — Safe concurrent execution with workspace isolation
- [ ] Notification hooks — Webhooks/Slack alerts on score regressions
- [ ] Multi-repo support — Evaluate agents across multiple project repositories
- [ ] Add more informations based on the context token etc ... input tokens and output tokens, latency, cost, etc ...
