# ADR-006: Code Quality Gates (ESLint + Prettier + Husky)

**Status:** Accepted
**Date:** 2026-02-27

## Context

As the codebase grows with multiple packages (`packages/agent-eval`, `apps/eval-ui`, `apps/docs`, `apps/example-target-app`), maintaining consistent code style and catching errors early becomes critical. Without automated enforcement, style drift and broken commits inevitably creep in — especially when multiple AI agents contribute code alongside human developers.

## Decision

We enforce **four mandatory gates** before every commit, automated via Husky + lint-staged:

1. **ESLint** — Static analysis catching bugs, unused variables, React hooks violations
2. **Prettier** — Deterministic code formatting (no style debates)
3. **Vitest** — All unit and E2E tests must pass
4. **tsup build** — TypeScript compilation + bundle must succeed

### Tooling Stack

| Tool                          | Role                                              | Scope                               |
| ----------------------------- | ------------------------------------------------- | ----------------------------------- |
| **ESLint v9** (flat config)   | Linting                                           | `*.ts`, `*.tsx`, `*.js`, `*.mjs`    |
| **typescript-eslint**         | TypeScript-specific rules                         | `*.ts`, `*.tsx`                     |
| **eslint-plugin-react-hooks** | React hooks correctness                           | `*.tsx`                             |
| **eslint-config-prettier**    | Disables ESLint rules that conflict with Prettier | All                                 |
| **Prettier**                  | Formatting                                        | All files (TS, JSON, MD, YAML, CSS) |
| **Husky**                     | Git hooks manager                                 | Pre-commit                          |
| **lint-staged**               | Runs linters on staged files only                 | Pre-commit                          |

### Pre-commit Hook Flow

```
git commit
  └─ .husky/pre-commit
       ├─ pnpm lint-staged     (ESLint --fix + Prettier --write on staged files)
       ├─ pnpm test            (Vitest: all unit + E2E tests)
       └─ pnpm build           (tsup: ESM + CJS + DTS compilation)
```

If **any** step fails, the commit is rejected.

### ESLint Configuration

We use the ESLint v9 flat config format (`eslint.config.js`) with:

- `@eslint/js` recommended rules as the base
- `typescript-eslint` recommended rules for TS files
- `eslint-plugin-react-hooks` for TSX files
- `eslint-config-prettier` as the final layer to avoid format conflicts
- Unused vars are warnings (with `_` prefix ignored) — strict enough to catch issues, lenient enough to not block WIP code

### Prettier Configuration

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

Double quotes + semicolons + trailing commas: the most common TypeScript convention, minimizing diff noise.

## Alternatives Considered

### No pre-commit hooks (CI-only)

Rejected. Catching issues only in CI means broken commits land on branches, polluting `git bisect` and requiring fixup commits. The feedback loop is too slow.

### Biome (all-in-one linter + formatter)

Considered. Biome is faster, but its ESLint rule coverage for TypeScript and React is still maturing. The ESLint ecosystem has broader plugin support (e.g., `react-hooks` rules are critical for the dashboard app). We can revisit when Biome reaches parity.

### Prettier only (no ESLint)

Rejected. Prettier handles formatting but not logic errors. ESLint catches unused imports, React hooks violations, and TypeScript-specific issues that Prettier cannot.

## Consequences

- **Every commit is guaranteed clean** — no broken builds, no lint errors, no formatting drift
- **AI agents must respect the gates** — the Husky hook blocks `git commit` if any check fails
- **Slight commit overhead** — tests + build run on every commit (~5s). Acceptable given our test suite size.
- **`--no-verify` is explicitly banned** — documented in AGENTS.md as a rule violation
