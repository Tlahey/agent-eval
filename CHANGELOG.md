# Changelog

All notable changes to the **agent-eval** package will be documented in this file.

This project uses [Changesets](https://github.com/changesets/changesets) for versioning and changelog generation.

## [0.1.0] — Initial Release

### Features

- **Core Framework**: Sequential test runner with Git isolation (`git reset --hard && git clean -fd`)
- **LLM-as-a-Judge**: Vercel AI SDK with structured output (Zod schema) returning `{ pass, status, score, reason, improvement }`
- **CLI Runners**: Spawn any CLI agent via `{{prompt}}` template
- **API Runners**: Direct LLM calls via Vercel AI SDK (Anthropic, OpenAI, Ollama)
- **Fluent Expect API**: `expect(ctx).toPassJudge({ criteria, expectedFiles, thresholds })`
- **Custom Thresholds**: Three-level scoring (PASS / WARN / FAIL) with configurable `warn` and `fail` thresholds
- **SQLite Ledger**: Node 22 `node:sqlite` for zero-dependency result storage with indexed queries
- **HITL Overrides**: Human-in-the-loop score overrides with audit trail
- **Dynamic Reporter**: Default (spinners), Verbose, and Silent reporters with summary table
- **CLI**: `agenteval run`, `agenteval ledger`, `agenteval ui` commands
- **Dashboard UI**: React + Tailwind + Recharts with sidebar, score trend, pass/warn/fail donut, runner ranking, GitHub-style diff viewer
- **VitePress Docs**: Full documentation site with Mermaid diagrams
- **CI/CD**: GitHub Actions pipeline (test → build → typecheck)
