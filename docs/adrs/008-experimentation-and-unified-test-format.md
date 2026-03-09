# ADR 008: Unified Mission-Based Testing and A/B Experiments

## Status

Accepted

## Context

The initial version of AgentEval supported two execution modes: imperative (`agent.run()`) and declarative (`agent.instruct()`). As the framework evolved to support multi-model comparisons and multi-step verification tasks, several issues emerged:

1.  **Complexity**: Having multiple ways to trigger an agent made the API inconsistent and harder to learn.
2.  **Readability**: Long prompts (sometimes 50+ lines) were hard to manage as function arguments in the `test()` registration.
3.  **Experimentation Bias**: Comparing model performance was difficult because there was no formal way to ensure that the exact same prompt was being sent to different configurations (runners, skills, MCPs).
4.  **Registry Scaling**: The original "run all tests on all runners" model led to high costs and long execution times when users only wanted to test a specific model or configuration for a subset of tests.

## Decision

We decided to unify the framework around a **Mission-Based Declarative API** and a formal **Experimentation Model**.

### 1. Unified Test API

We moved from manual agent execution to an automatic pipeline. The mission (prompt) is now defined inside the test logic using `ctx.prompt()`.

```ts
test("Title", async ({ ctx }) => {
  ctx.prompt(`Long prompt here...`); // Mission definition
  await expect(ctx).toPassJudge({ criteria: "..." });
});
```

### 2. Native A/B Testing (Variants)

We introduced `test.variants` (now integrated into the main `test()` signature) to allow scientific benchmarking. A **Common Mission** is defined once, and multiple **Variants** define the technical configurations to compare.

### 3. Prompt Templating (Enrichment)

To test the impact of personas or constraints, we added `enrichPrompt`. This allows wrapping the base mission in a variant-specific template (e.g., `Expert persona: {{prompt}}`) without modifying the mission itself.

### 4. Runner Registry and Defaulting

We transitioned from a simple list of runners to a global registry. A `defaultRunner` property in the config determines which runner to use for standard tests, while variants can refer to any runner in the registry by ID.

### 5. Scoped Package and Removal of Deprecated Features

To prepare for public release and ensure a clean foundation, we renamed the package to `@tlahey/agent-eval` and removed all deprecated imperative methods (`run`, `instruct`).

## Consequences

- **Breaking Changes**: All existing tests must be migrated to the `ctx.prompt()` format.
- **Improved DX**: Large prompts are now much easier to read and maintain using backticks inside the test function.
- **Scientific Rigor**: Users can now prove the impact of a specific prompt template or skill by isolating variables in an experiment.
- **Cost Control**: Users have granular control over which runner executes which test through the registry and variants system.
- **Standardization**: AgentEval now enforces a single, robust way to evaluate agents, making it easier to integrate with CI/CD and analytics tools.
