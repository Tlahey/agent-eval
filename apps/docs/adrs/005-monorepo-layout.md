# ADR-005: Monorepo Layout (apps/ + packages/)

**Status:** Accepted  
**Date:** 2026-02-27  
**Context:** AgentEval is both a distributable npm package and an ecosystem with documentation, example apps, and future UI tools.

## Decision

Use a **pnpm workspace monorepo** with two top-level directories:

- `packages/` — publishable npm libraries
- `apps/` — non-publishable applications (docs, dashboard, example target apps)

## Layout

```
agent-eval/
├── packages/
│   └── agent-eval/            # The core framework (published to npm)
├── apps/
│   ├── docs/                  # VitePress documentation site
│   ├── eval-ui/               # React dashboard (Tailwind + Recharts)
│   └── example-target-app/    # E2E target app for integration tests
└── docs/adrs/                 # Architecture Decision Records
```

## Rationale

### Why separate `apps/` and `packages/`?

- **`packages/`** contains code that gets **published** to npm with `main`, `module`, `types`, `bin` fields
- **`apps/`** contains code that gets **deployed** (docs site) or **run locally** (dashboard, target apps)
- Clear separation prevents accidental publishing of internal apps
- Each workspace has its own `package.json`, `tsconfig.json`, and build config

### Why pnpm?

- **Strict dependency resolution**: no phantom dependencies (unlike npm/yarn)
- **Content-addressable storage**: shared dependencies are linked, not duplicated
- **Workspace protocol**: `workspace:*` enables cross-package references without publishing
- **Fast**: parallel installation with hard links

### Why not Turborepo / Nx?

- Adds complexity we don't need yet
- pnpm workspaces + simple `--filter` commands are sufficient
- Can adopt Turborepo later if build orchestration becomes a bottleneck

### Why `example-target-app` in `apps/`?

- It's a real application with a build step, Vitest tests, and a mock agent
- Used by E2E integration tests to validate the full AgentEval pipeline
- Living in `apps/` keeps it consistent with other runnable projects
- The name makes its role clear: it's the **target** that agents are evaluated against

## Workspace Configuration

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
```

## Consequences

- All workspace commands use `pnpm --filter <name>` to target specific packages
- Root `package.json` contains convenience scripts that delegate to filters
- Adding a new package: create a directory in `packages/` or `apps/` with a `package.json`
- CI runs `pnpm install` once, then can build/test individual workspaces in parallel
