# ADR 009: Mandatory Variants and Explicit Baseline

## Status

Accepted (2025-03-09)

## Context

Previously, AgentEval used a `defaultRunner` in the global configuration to execute tests that didn't specify variants. While this was convenient, it introduced "magic" behavior and created an inconsistency between standard tests and A/B experiments.

## Decision

We decided to adopt a **"Full Explicit Baseline"** architecture:

1.  **Removal of `defaultRunner`**: The global `defaultRunner` property is removed from the configuration. Every execution target must now be defined at the test level.
2.  **Mandatory 3-Parameter `test()` Signature**: The `test()` function now strictly requires three arguments: `title`, `variants[]`, and `logicFn`.
    - `test(title, variants, fn)`
3.  **Unified Data Model**: Every test is now technically an experiment. Even a "single" test run must explicitly define a "baseline" variant.
4.  **Variant Properties**: The internal `TestVariant` structure is standardized:
    - `id`: Internal identifier (e.g., "baseline").
    - `name`: Display name for the UI (e.g., "Baseline").
    - `runner`: The ID of the runner (must match one in the configuration registry).
    - `enrichPrompt`: Optional template for prompt engineering.

## Consequences

- **Zero Ambiguity**: The developer has absolute control and visibility over which runner is used for every test.
- **Improved UI/UX**: The Dashboard and Ledger now handle a single, consistent data structure. Every run has a variant name and ID, making reporting and comparison logic much simpler.
- **Slightly More Verbose Tests**: Developers must write a few more lines to define the baseline, but the payoff is a much more robust and predictable testing suite.
- **Type Safety**: Using `createTest<RunnerIds>()` provides full type safety for the `runner` property in variants.
