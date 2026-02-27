# 📄 PRD: AgentEval Framework (Phase 2 & Go-To-Market)

**Status:** Phase 1 (Core) Complete. Transitioning to Phase 2 (UI, E2E, Distribution).
**Objective:** Finalize a local, zero-dependency testing framework for AI coding agents, featuring guaranteed Git isolation, LLM-as-a-judge evaluation, and a native SQLite-powered analytical dashboard.

---

## 💡 1. Genesis & Rationale: Why build AgentEval?

Testing an AI coding agent represents a completely new engineering paradigm that standard testing tools cannot handle. We built AgentEval after a strict "Build vs. Buy / Adapt" analysis:

* **Why not Vitest or Jest?**
Standard frameworks are built for extreme speed and parallel execution in memory. AI agents, however, mutate the actual file system and commit to Git. Running agent tests concurrently in Vitest instantly corrupts the local repository state. Furthermore, agent tasks take minutes to run, conflicting with the millisecond timeouts of unit test runners.
* **Why not Promptfoo?**
Promptfoo is excellent for Text-in/Text-out evaluation (RAGs, Chatbots). However, evaluating code-generating agents requires running heavy side-effects (CLI commands, capturing Git diffs, reading Next.js build logs). Forcing a text-evaluator to handle file-system operations required fragile workarounds. We needed a tool natively designed for monorepo execution and file-state management.
* **Why not Langfuse or Cloud LLMOps?**
Sending proprietary enterprise source code, Git diffs, and build logs to a third-party cloud service for evaluation raises significant data privacy and security concerns. We needed a 100% local, privacy-first ledger.
* **Why SQLite over JSONL?**
Storing hundreds of full Git diffs and terminal logs quickly bloats flat files. By leveraging Node 22's native `node:sqlite`, we gain the power, compression, and querying speed of a relational database for our UI dashboard, **without adding a single external npm dependency**.

**The AgentEval Promise:** A familiar Vitest-like syntax, strict sequential execution, guaranteed Git isolation (`git reset --hard`), and a high-performance local SQLite analytics engine.

---

## 🎯 2. Executive Summary & Current State

**What is already achieved (Phase 1 Foundation):**

* A robust **Monorepo** setup (`apps/` and `packages/`).
* The **Core Engine** (`types`, `git`, `config`, `context`, `judge`, `expect`, `runner`, `cli`).
* **100% Git Isolation:** Automated `git reset --hard` between runs.
* **LLM-as-a-Judge:** Integration with Vercel AI SDK enforcing structured JSON outputs.
* **Testing & Docs:** 32 Vitest suites passing and 10 pages of VitePress documentation.

---

## 🚀 3. Roadmap: What Needs to be Built (The "Delta")

### Epic 1: The "Proof of Value" (Real E2E Integration)

Before releasing the tool, we must prove it works in real-world conditions.

* **Requirement:** Create a dummy target application and run a real agent (e.g., GitHub Copilot CLI or Aider) against it using an actual `.eval.ts` scenario.
* **Goal:** Validate the end-to-end flow: Trigger Agent -> Capture Git Diff -> Run Vitest in Context -> Evaluate via LLM -> Write to SQLite Ledger.

### Epic 2: The SQLite Ledger Migration

* **Requirement:** Refactor the current `ledger.ts` to use Node 22's native `import { DatabaseSync } from 'node:sqlite'`.
* **Goal:** Create a local `.agenteval/ledger.sqlite` database. Create a `runs` table to safely and efficiently store test IDs, timestamps, models, scores, raw diffs, and LLM reasoning.

### Epic 3: API-Based Runners

Many enterprise agents operate as HTTP APIs rather than CLI tools.

* **Requirement:** Implement the `type: "api"` runner in the configuration.
* **Goal:** Allow users to define custom fetch calls or SDK invocations to trigger the agent, passing the prompt as a payload and awaiting the response.

### Epic 4: The Visual Dashboard (Phase 2 UI)

The CLI currently holds a placeholder for `agenteval ui`.

* **Requirement:** A lightweight React application (served via a local Node server) that queries the local `.agenteval/ledger.sqlite` database.
* **Features:**
* **Trend Graphs:** Line charts plotting Score over Time per Model. SQL `GROUP BY` will make rendering this instantaneous.
* **Execution Logs:** Clickable tables to view the LLM Judge's Markdown reasoning, the Git Diff, and the CI logs stored in the DB.



### Epic 5: Infrastructure & Distribution

* **Requirement 1 (Publishing):** Setup build steps (`tsup` or `tsc`) to compile the package for npm publishing (or internal company registry).
* **Requirement 2 (CI/CD):** Create a GitHub Actions workflow demonstrating how to run `pnpm run eval` on pull requests, passing the AI API keys securely.

---

## ✅ 4. The Execution Checklist

Here is the exact task breakdown to clear the remaining backlog.

### 🗄️ 1. SQLite Migration (Do this first)

* [ ] **Import Native SQLite:** Refactor `packages/agent-eval/src/ledger.ts` to use `node:sqlite`.
* [ ] **DB Initialization:** Write the `CREATE TABLE IF NOT EXISTS runs (...)` logic.
* [ ] **Insert Logic:** Update the `recordTestRun` function to execute SQL `INSERT` statements with parameterized queries.

### 🧪 2. Real E2E Test Implementation

* [ ] **Setup Target App:** Create `apps/dummy-react-app` with a basic React component and Vitest.
* [ ] **Configure Agent:** Authenticate a real CLI agent locally (Copilot/Aider).
* [ ] **Write Scenario:** Create `apps/dummy-react-app/evals/button.eval.ts`.
* [ ] **Execute & Verify:** Run the test. Verify the code mutates, the LLM evaluates, and data is correctly written to `.agenteval/ledger.sqlite`.

### 🔌 3. API-Based Runners

* [ ] **Update Config Schema:** Allow `agenteval.config.ts` to accept an API runner definition (URL, headers, method).
* [ ] **Implement Runner Logic:** Write the HTTP request handling logic for `runner.type === 'api'`.

### 📊 4. Phase 2 Dashboard (UI)

* [ ] **Scaffold UI App:** Create `apps/eval-ui` using Vite + React + Tailwind + Recharts.
* [ ] **Create Local API:** Update `agenteval ui` CLI command to spin up an Express/Hono server that queries the SQLite DB (e.g., `GET /api/runs?testId=wnf-001`).
* [ ] **Build Dashboard View:** Create the main data table listing tests and latest scores.
* [ ] **Build Analytics View:** Integrate Recharts to draw the "Score over Time" line graph.
* [ ] **Build Drill-down Modal:** Create a modal to display the Markdown Reason, syntax-highlighted Diff, and terminal Logs.

### 📦 5. Infrastructure & Distribution

* [ ] **Build Step:** Configure `tsup` or `tsc` in `package.json` to compile to CommonJS/ESM.
* [ ] **NPM Config:** Ensure `main`, `module`, `types`, and `bin` fields are set correctly.
* [ ] **CI Pipeline (Framework):** Add `.github/workflows/ci.yml` to run the 32 Vitest suites on every commit.
* [ ] **CI Pipeline (Agent Evals):** Create a sample GitHub Actions workflow showing users how to run agent evaluations in CI.