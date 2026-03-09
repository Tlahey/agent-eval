import { defineConfig } from "@tlahey/agent-eval";
import { AnthropicModel, CliModel } from "@tlahey/agent-eval/llm";

/**
 * Experiment Config — Prompt Engineering & Metadata
 *
 * Demonstrates A/B testing (test.variants) using the local mock agent.
 * No API keys required for the runner.
 *
 * Usage:
 *   agenteval run --config evals/experiments/agenteval.config.ts
 */
export default defineConfig({
  rootDir: ".",

  runners: [
    {
      id: "mock-agent",
      model: new CliModel({ command: 'node scripts/mock-agent.mjs "{{prompt}}"' }),
    },
  ],

  // Using a real model for judge is recommended, but we'll use a placeholder
  // or the user can provide their own ANTHROPIC_API_KEY.
  judge: {
    model: new AnthropicModel({ model: "claude-3-5-sonnet-20241022" }),
  },

  beforeEach: ({ ctx }) => {
    ctx.addTask({
      name: "Tests",
      action: ({ exec }) => exec("pnpm test"),
      criteria: "All existing and new tests must pass",
      weight: 3,
    });
  },

  runs: 3,
  testFiles: "evals/experiments/prompt-engineering.eval.ts",
  outputDir: ".agenteval",
  timeout: 60_000,
});
