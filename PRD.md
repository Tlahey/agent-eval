# 📄 PRD: AgentEval Framework (Codename)

**Status:** Initial Draft / Concept
**Objective:** Create a local, agnostic, and sequential testing framework to evaluate AI coding agents, complete with an integrated analytical dashboard for tracking historical performance.

## 🎯 1. Vision & Goals

Currently, standard testing frameworks (like Vitest or Jest) are ill-suited for testing AI agents because they mutate the file system concurrently and handle long execution times poorly. The goal of **AgentEval** is to provide a Developer Experience (DX) similar to Vitest, but specifically engineered to orchestrate, isolate (via Git), evaluate (via LLM-as-a-Judge), and historically track the performance of AI coding agents.

---

## 🛠️ PHASE 1: The Execution Engine (Core Runner)

This phase focuses on creating a local npm CLI package (`@dkt/agent-eval`) to be installed directly in the project repository.

### 1.1 Configuration File (`agenteval.config.ts`)

A single entry point to define the "Runners" (the agents being tested) and the "Judges" (the LLM evaluators).

* **Agnosticism:** Ability to configure CLI commands (e.g., local Copilot CLI) or direct API calls (OpenAI, Anthropic, local Ollama).
* **Model Matrix:** Ability to define globally or per-test which models to compare (e.g., run every test against both `gpt-4.5` AND `claude-3.7-sonnet`).

### 1.2 Test Syntax (Developer Experience)

A fluid and familiar API. The framework exposes a `test` method that injects a `context` object (`ctx`).

* The `ctx` acts as a temporal black box: it stores the logs, diffs, and results of commands executed during the test.
* **Guaranteed Isolation:** The engine automatically executes a `git reset --hard && git clean -fd` *before* each iteration.

**Target API Example:**

```typescript
import { test, expect } from "@dkt/agent-eval";

test("Add a Close button to the Banner", async ({ agent, ctx, judge }) => {
  // 1. Trigger the agent
  await agent.run("Add a Close button inside the banner");

  // 2. Utility functions to enrich the context
  ctx.storeDiff(); // Captures the current git diff
  await ctx.runCommand("vitest", "pnpm test -- libs/ui/Banner"); 
  await ctx.runCommand("build", "pnpm run build");

  // 3. Validation via LLM-as-a-Judge
  await expect(ctx).toPassJudge({
    criteria: "- Use VpIconButton\n- Have aria-label 'Close'",
    model: "claude-3.5-sonnet" // Optional override
  });
});

```

### 1.3 Matrix Testing (Multi-Model Execution)

If the configuration specifies multiple models, the Runner will loop through the entire test sequence for each model, resetting the Git state in between each run to ensure pristine environments.

### 1.4 The Data Ledger

At the end of the execution, the framework generates and appends to a local file (e.g., `.agenteval/ledger.jsonl`).

* **Record Structure:** `Test ID`, `Timestamp`, `Agent Model`, `Judge Model`, `Score (0.0 to 1.0)`, `Reason (Markdown)`, `Raw Context (Diff, Logs)`.

---

## 📊 PHASE 2: The Visual Interface (Local Dashboard)

A CLI command (`pnpm agenteval ui`) that launches a local server (e.g., Vite + React or Next.js) to read and visualize the `ledger.jsonl` file.

### 2.1 Home Screen: Overview Dashboard

* **Scenario List:** A data table listing all executed test IDs.
* **Health Status:** The most recent score obtained for each scenario.
* **Search/Filter:** Filter by tags, date, or status (Pass/Fail).

### 2.2 Test Detail Screen (Analytics Graph)

Clicking on a test ID navigates to a dedicated analytics view:

* **Evolution Graph (Line Chart):**
* X-Axis: Time (Execution Dates).
* Y-Axis: Score (0.0 to 1.0).
* Series: A differently colored line for **each agent model** tested (e.g., Blue line for Copilot, Red line for Cursor). This allows instant visualization of which model performs best on this specific scenario over time.



### 2.3 Execution History (Data Table & Drill-down)

Below the graph, a chronological table of all runs for this specific test:

* **Columns:** Date, Agent Model, Score, Reason (Preview).
* **Detailed View (Modal/Drawer):** Clicking a row opens a side panel containing:
1. **Judge's Verdict:** The fully formatted Markdown text explaining the evaluation.
2. **"Diff" Tab:** A visual Git Diff component showing exactly what the agent coded.
3. **"Logs" Tab:** The raw outputs of the background commands (Vitest, TSC, Build) stored in the `ctx`.



---

## 🏗️ Recommended Technical Architecture

* **Core Runner:** Pure Node.js (TypeScript), utilizing sequential `for...of` loops with `execFileSync` to guarantee Git state stability and prevent concurrency issues.
* **Storage:** Local JSONL (JSON Lines) file. Highly performant for appending and streaming, easily versionable in Git (or ignored via `.gitignore` if it grows too large).
* **UI Interface:** React application (Vite / Tailwind / Recharts), statically served by the Node CLI (using `express` or `hono` for a lightweight local API to read the JSONL).
* **Judge Communication:** Integration with the `@ai-sdk/anthropic` or `openai` SDK, utilizing `response_format: { type: "json_schema" }` to strongly force the judge to return the exact `{pass, score, reason}` structure.

---

## 🚀 Next Steps

1. **Package Init:** Create a `packages/agent-eval` folder within the monorepo.
2. **Runner PoC (Phase 1):** Code the core `test()` execution loop, the Git reset mechanism, and the basic JSON appending logic.
3. **Migration:** Translate the existing `wnf-001` scenario into the new `test()` syntax to validate the Developer Experience.

---

Would you like me to generate the foundational `eval-framework.ts` code (the core runner from Phase 1) to get the package started right away?