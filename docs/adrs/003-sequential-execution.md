# ADR-003: Sequential Execution Model

**Status:** Accepted  
**Date:** 2026-02-27  
**Context:** AI coding agents mutate the file system and Git state as side effects of their execution.

## Decision

All evaluation tests run **strictly sequentially** — one test at a time, one runner at a time.

## Rationale

### The Problem with Parallelism
- Standard test runners (Vitest, Jest) run tests in parallel for speed
- AI agents **write real files**, **stage changes**, and **commit to Git**
- Two agents running concurrently in the same repo will:
  - Overwrite each other's file changes
  - Corrupt Git staging area (`git add` conflicts)
  - Produce non-deterministic diffs
  - Make evaluation results meaningless

### The Sequential Contract
1. Before each test: `git reset --hard HEAD && git clean -fd` (guaranteed pristine state)
2. Run the agent (may take 1-5 minutes)
3. Capture the diff and run validation commands
4. Evaluate with the LLM judge
5. Record results to the ledger
6. Repeat for the next runner/test

### Implementation
- The runner uses `for...of` loops (no `Promise.all`, no worker threads)
- Each test gets its own `EvalContext` instance
- Git isolation is **mandatory** and cannot be skipped

## Trade-offs

| Aspect | Sequential | Parallel |
|--------|-----------|----------|
| Correctness | ✅ Guaranteed | ❌ Race conditions |
| Speed | Slower (minutes per test) | Faster wall-clock |
| Simplicity | ✅ Simple `for` loop | Complex isolation needed |
| Git safety | ✅ Clean state per test | ❌ Corrupted state |

## Consequences

- A suite of 10 tests × 3 runners = 30 sequential executions (potentially 30-150 minutes)
- This is acceptable: agent evaluations are inherently slow (they generate code, not text)
- Future optimization: run independent test *suites* in separate Git worktrees (not in scope for Phase 2)
