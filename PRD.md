# 📄 PRD: AgentEval Framework - Phase 3 (The Last Mile)

**Status:** Core Engine (Phase 1) and SQLite/API integrations (Phase 2) are complete. Transitioning to End-to-End Validation, UI Dashboard, and Open-Source/Internal Distribution.
**Objective:** Prove the framework works in real-world conditions, deliver a highly themeable analytical UI, and finalize the distribution pipeline.

---

## 🎯 1. Epic 1: The "Proof of Value" (Real E2E Test)

**Priority: 🔴 HIGH (Must be done first to validate the entire architecture)**

Before building a UI, we must generate real data by running a true E2E evaluation against a tangible codebase.

- **Requirements:**

1. **Dummy Application (`apps/dummy-react-app`):** Scaffold a minimal React application (using Vite) within the monorepo. It should contain at least one component (e.g., `Banner.tsx`) and a basic Vitest setup.
2. **Scenario Creation:** Write a real evaluation script (`apps/dummy-react-app/evals/button.eval.ts`) using the `agent-eval` API.

- _Goal:_ Ask the agent to "Add a close button to the Banner component".
- _Assertions:_ Verify the file was modified, run `pnpm test`, and use `expect(ctx).toPassJudge()`.

3. **Real Agent Execution:** Run the test using an actual LLM (via the newly created `api` runner or a local CLI like Copilot/Aider).
4. **Verification:** Confirm that `.agenteval/ledger.sqlite` is successfully populated with a real Git Diff, terminal logs, and a structured JSON evaluation from the LLM Judge.

---

## 📊 2. Epic 4: The Visual Dashboard (`apps/eval-ui`)

**Priority: 🟡 MEDIUM**

A standalone, lightweight web application served locally by the `agenteval ui` CLI command to visualize the SQLite ledger data.

- **Tech Stack:** React, Vite, Recharts (for graphs), Tailwind CSS.
- **Architecture:**
- **Local API:** The `agent-eval` CLI will spin up a small server (e.g., Express or Hono) that reads `.agenteval/ledger.sqlite` and exposes JSON endpoints (e.g., `GET /api/runs`).
- **Static Serving:** The UI will be pre-built and served as static files by this local CLI server.

- **Key Views:**

1. **Dashboard:** A data table summarizing all unique tests and their latest scores/status.
2. **Analytics:** A line chart (Recharts) showing Score (Y-axis) over Time (X-axis), grouped by Agent Model (to compare GPT-4 vs. Claude 3.5 on the same test).
3. **Drill-down Modal:** A detailed view of a specific run containing:

- The LLM Judge's Markdown reasoning.
- A syntax-highlighted Git Diff block.
- The raw CI execution logs.

- **🎨 Crucial Design Constraint: Theming & Tailwind Extraction**
- The UI **must** be built with a centralized, abstract color palette.
- **No hardcoded colors** (e.g., never use `text-blue-500` or `bg-gray-100`).
- Instead, CSS variables must be defined at the root (e.g., `--color-primary`, `--color-surface`, `--color-text-base`) and mapped in `tailwind.config.js`.
- _Why?_ This allows any enterprise adopting this tool to instantly swap the CSS variables to match their brand identity (e.g., changing it to Decathlon blue/green) without touching the React components.

---

## 📦 3. Epic 5: Distribution & CI/CD

**Priority: 🟢 LOW**

Finalizing the package so it can be consumed seamlessly by end-users in their own repositories.

- **Requirements:**

1. **NPM Publishing Prep:** \* Configure the `files` array in `package.json` to include only the `dist/` folder and necessary assets.

- Run `npm pack` to inspect the generated tarball and ensure no bloated source files or local SQLite DBs are accidentally included.
- Add a `prepublishOnly` script to ensure tests pass and `tsup` builds cleanly before publishing.

2. **User CI/CD Example:** Create a template file (`docs/examples/github-actions.yml`) demonstrating how a user integrates this into their PR workflow. It must show:

- How to checkout code.
- How to install dependencies.
- How to securely pass `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`.
- How to run `npx agenteval run`.

---

## 🤖 4. Required Updates to `AGENTS.md`

To ensure future AI coding assistants respect the new UI constraints, the following rules **MUST** be explicitly added to the `AGENTS.md` file at the root of the project:

```markdown
### UI Dashboard Development (`apps/eval-ui`)

When modifying or creating components for the Visual Dashboard, you MUST adhere to the following styling rules:

1. **Strict Semantic Theming:** We use a centralized CSS variable system mapped to Tailwind CSS.
2. **NO Hardcoded Tailwind Colors:** Do NOT use utility classes like `text-blue-600`, `bg-slate-100`, or `border-red-500`.
3. **Use Semantic Classes:** You must ONLY use the semantic classes defined in `tailwind.config.js`. For example:
   - Backgrounds: `bg-background`, `bg-surface`, `bg-surface-hover`
   - Text: `text-primary`, `text-secondary`, `text-muted`
   - States: `text-success`, `bg-error`, `border-warning`
4. **Changing Colors:** If a new shade is needed, add it as a CSS variable in `index.css` and map it in `tailwind.config.js`. Do not apply hex codes directly in the JSX.
```

---

## ✅ 5. Execution Checklist

### Epic 1: E2E Test (Start Here)

- [ ] Initialize `apps/dummy-react-app` using Vite.
- [ ] Create `Banner.tsx` and `Banner.test.tsx`.
- [ ] Write `evals/button.eval.ts` mapping to the dummy app.
- [ ] Execute `agenteval run` using a real model.
- [ ] Verify `.agenteval/ledger.sqlite` contains the generated diff and evaluation.

### Epic 4: Visual Dashboard & Theming

- [ ] Scaffold `apps/eval-ui` with Vite + Tailwind.
- [ ] Create `index.css` with CSS variables for the color palette.
- [ ] Update `tailwind.config.js` to map colors to CSS variables.
- [ ] Update `AGENTS.md` with the new UI styling rules.
- [ ] Build the Express/Hono API server inside `agent-eval` CLI to serve SQLite data.
- [ ] Build the React Views (Table, Recharts Graph, Diff Modal).
- [ ] Connect the `agenteval ui` command to serve the built React static files and start the API.

### Epic 5: Distribution

- [ ] Verify `package.json` exports, `bin`, and `files` fields.
- [ ] Run `npm pack` and verify tarball contents.
- [ ] Create `.github/workflows/user-example.yml` template in the docs.
