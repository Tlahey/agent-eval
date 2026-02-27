# ADR-001: Why a Custom Framework

**Status:** Accepted  
**Date:** 2026-02-27  
**Context:** We need to evaluate AI coding agents that generate code, mutate files, and commit to Git.

## Decision

Build a custom evaluation framework (AgentEval) instead of adapting existing tools.

## Alternatives Considered

### Vitest / Jest

- Built for **extreme speed and parallel execution** in memory
- AI agents mutate the **actual file system** and commit to Git
- Running agent tests concurrently **corrupts the local repository state**
- Agent tasks take **minutes**, conflicting with millisecond timeouts of unit test runners
- **Verdict:** Wrong execution model — needs sequential, side-effect-aware orchestration

### Promptfoo

- Excellent for **Text-in/Text-out** evaluation (RAGs, Chatbots)
- Evaluating code-generating agents requires **running CLI commands, capturing Git diffs, reading build logs**
- Forcing Promptfoo to handle heavy side-effects required **fragile workarounds** (Bash escaping, JSON parsing hacks)
- **Verdict:** Wrong abstraction level — designed for prompt evaluation, not file-system operations

### Langfuse / Cloud LLMOps

- Perfect for **production observability**, not a local test runner
- Sending **proprietary enterprise code, Git diffs, and build logs** to a third-party cloud raises **data privacy and security concerns**
- **Verdict:** Wrong deployment model — we need 100% local, privacy-first evaluation

## Consequences

- We own the full test lifecycle (trigger → capture → evaluate → record)
- We can provide Vitest-like DX while enforcing sequential execution
- We maintain a local ledger with zero cloud dependency
- Higher initial development cost, but perfect fit for the use case
