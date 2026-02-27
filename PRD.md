# 📄 PRD: AgentEval Framework (Phase 2 & Go-To-Market)

**Status:** Phase 1 (Core) Complete. Transitioning to Phase 2 (UI, E2E, Distribution).
**Objective:** Finalize the local, agnostic testing framework for AI coding agents by proving its end-to-end capabilities, enabling API-based agent execution, setting up CI/CD, and delivering the analytical UI dashboard.

## 🎯 1. Executive Summary & Current State

The `@dkt/agent-eval` framework aims to solve the problem of testing AI coding agents that mutate the file system and require subjective evaluation.

**What is already achieved (The Foundation):**

* A robust **Monorepo** setup (`apps/` and `packages/`).
* The **Core Engine** (`types`, `git`, `config`, `context`, `judge`, `expect`, `runner`, `ledger`, `cli`).
* **100% Git Isolation:** Automated `git reset --hard` between runs.
* **LLM-as-a-Judge:** Integration with Vercel AI SDK (Anthropic, OpenAI, Ollama) enforcing structured JSON outputs.
* **Testing & Docs:** 32 Vitest suites passing (testing the framework itself) and 10 pages of VitePress documentation.

---

## 🚀 2. Roadmap: What Needs to be Built (The "Delta")

### Epic 1: The "Proof of Value" (Real E2E Integration)

Before releasing the tool, we must prove it works in real-world conditions, not just in isolated unit tests.

* **Requirement:** Create a dummy target application and run a real agent (e.g., GitHub Copilot CLI, Aider, or a custom local CLI) against it using an actual `.eval.ts` scenario.
* **Goal:** Validate the end-to-end flow: Trigger Agent -> Capture Git Diff -> Run Vitest in Context -> Evaluate via Anthropic/OpenAI -> Write to Ledger.

### Epic 2: API-Based Runners

Currently, the framework only triggers agents via CLI commands. Many enterprise agents operate as HTTP APIs or SDKs.

* **Requirement:** Implement the `type: "api"` runner.
* **Goal:** Allow the configuration file to define custom fetch/axios calls or SDK invocations to trigger the agent, passing the prompt as a payload and awaiting the response before continuing the test.

### Epic 3: The Visual Dashboard (Phase 2 UI)

The CLI currently holds a placeholder for `agenteval ui`. This needs to be a fully functional local web application.

* **Requirement:** A lightweight React application (served via a local Node server like Express or directly via Vite dev server) that reads `.agenteval/ledger.jsonl`.
* **Features:**
* **Trend Graphs:** Line charts plotting Score over Time per Model.
* **Execution Logs:** Clickable tables to view the LLM Judge's Markdown reasoning, the Git Diff, and the CI logs (Vitest/TSC) stored in the context.



### Epic 4: Infrastructure & Distribution

To be adopted by other teams, the package needs to be easily installable and runnable in standard CI environments.

* **Requirement 1 (Publishing):** Setup build steps (`tsup` or `tsc`) and package configuration for npm publishing (or internal company registry).
* **Requirement 2 (CI/CD):** Create a standard GitHub Actions (or GitLab CI) workflow demonstrating how to run `pnpm run eval` on pull requests, passing the necessary AI API keys securely.

---

## ✅ 3. The Execution Checklist

Here is the exact data and task breakdown needed to clear the remaining backlog.

### 🧪 1. Real E2E Test Implementation

* [ ] **Setup Target App:** Create a simple dummy project (e.g., `apps/dummy-react-app`) inside the monorepo with a basic React component and a Vitest setup.
* [ ] **Configure Agent:** Ensure a real CLI agent (like Copilot CLI or Aider) is installed and authenticated locally.
* [ ] **Write Scenario:** Create `apps/dummy-react-app/evals/button.eval.ts` using the `@dkt/agent-eval` syntax.
* [ ] **Execute & Verify:** Run the CLI command. Verify that the agent mutates the code, the framework catches the diff, the LLM evaluates it, and `.agenteval/ledger.jsonl` is successfully appended.

### 🔌 2. API-Based Runners

* [ ] **Update Config Schema:** Ensure `agenteval.config.ts` accepts an API runner definition (URL, headers, method, payload mapping).
* [ ] **Implement Runner Logic:** In `runner.ts` (or a dedicated `api-runner.ts`), write the logic to handle the HTTP request when `runner.type === 'api'`.
* [ ] **Timeout & Polling:** Add logic to handle long-running API requests (agents can take minutes to reply). Support basic polling or generous timeout configurations.

### 📊 3. Phase 2 Dashboard (UI)

* [ ] **Scaffold UI App:** Create `apps/eval-ui` using Vite + React + Tailwind + Recharts.
* [ ] **Create Local API:** Update the CLI (`agenteval ui`) to spin up a tiny local server that parses `ledger.jsonl` and serves it as a JSON endpoint (e.g., `GET /api/ledger`).
* [ ] **Build Dashboard View:** Create the main table listing all tests and their latest scores.
* [ ] **Build Analytics View:** Integrate Recharts to draw the "Score over Time" line graph, grouped by agent model.
* [ ] **Build Drill-down Modal:** Create a modal/drawer that displays the Markdown `<Reason>`, the syntax-highlighted `<FINAL_DIFF>`, and the terminal logs.

### 📦 4. Infrastructure & Distribution (CI/CD & NPM)

* [ ] **Build Step:** Configure `tsup` or `tsc` in `packages/agent-eval/package.json` to compile TypeScript to CommonJS and ESM before publishing.
* [ ] **NPM Config:** Ensure `main`, `module`, `types`, and `bin` fields are correctly mapped in `package.json`. Add a `prepublishOnly` script.
* [ ] **CI Pipeline (Framework):** Add `.github/workflows/ci.yml` to automatically run the 32 Vitest suites on every commit to the framework repository.
* [ ] **CI Pipeline (Agent Evals):** Add a sample GitHub Actions workflow showing users how to run the actual agent evaluations in CI (handling `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` secrets).