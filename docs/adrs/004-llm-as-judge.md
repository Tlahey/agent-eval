# ADR-004: LLM-as-a-Judge with Structured Output

**Status:** Accepted  
**Date:** 2026-02-27  
**Context:** Evaluating whether an AI agent correctly completed a coding task requires subjective judgment that cannot be expressed as deterministic assertions alone.

## Decision

Use an **LLM-as-a-Judge** pattern with the **Vercel AI SDK** and **Zod schema validation** to guarantee structured evaluation output.

## Rationale

### Why LLM-as-a-Judge?
- Agent output (code changes) is **non-deterministic** — the same prompt can produce different but equally valid solutions
- Traditional assertions (`expect(file).toContain("onClick")`) are too **brittle** and miss creative solutions
- An LLM can evaluate **intent**, **code quality**, **completeness**, and **best practices** holistically
- Scores provide a **continuous metric** (0.0–1.0) instead of binary pass/fail

### Why Vercel AI SDK?
- **Provider-agnostic**: swap between Anthropic, OpenAI, Ollama with a single config change
- **`generateObject()`** with Zod schema: guarantees the judge returns `{ pass, score, reason }`
- No manual JSON parsing, no regex extraction, no prompt engineering for format compliance
- Active maintenance and wide adoption in the TypeScript ecosystem

### The Structured Output Contract

```typescript
const JudgeResultSchema = z.object({
  pass: z.boolean(),
  score: z.number().min(0).max(1),
  reason: z.string(),  // Markdown explanation
});
```

The judge **always** returns this shape. No ambiguity, no parsing errors.

### Provider Support

| Provider | Package | Use Case |
|----------|---------|----------|
| Anthropic | `@ai-sdk/anthropic` | Claude models (recommended) |
| OpenAI | `@ai-sdk/openai` | GPT-4o, o1 models |
| Ollama | `@ai-sdk/openai` (compat) | Local models (privacy-first) |

### The Judge Prompt
The system prompt includes:
1. The evaluation **criteria** (written by the test author)
2. The **Git diff** (what the agent changed)
3. All **command outputs** (build logs, test results, linter output)

This gives the judge full context to make an informed evaluation.

## Trade-offs

- **Cost**: Each judgment requires an LLM API call (~$0.01–0.10 per evaluation)
- **Latency**: 2-10 seconds per judgment (acceptable given agent tasks take minutes)
- **Non-determinism**: Two judges may score differently — mitigated by tracking scores over time in the ledger
- **Ollama option**: Zero cost, full privacy, at the expense of evaluation quality

## Consequences

- Every test file uses `await expect(ctx).toPassJudge({ criteria: "..." })`
- The judge model is configurable per-project and per-test
- Historical scores in the ledger enable trend analysis ("is this agent getting better?")
