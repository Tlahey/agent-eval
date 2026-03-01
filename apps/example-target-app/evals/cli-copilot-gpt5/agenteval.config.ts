import { defineConfig } from "agent-eval";
import { AnthropicModel } from "agent-eval/providers/anthropic";

/**
 * CLI Runner — GitHub Copilot with GPT-5
 *
 * Uses `copilot` CLI with a specific model flag. The agent output
 * is captured from stdout — AgentEval records whatever the CLI
 * prints to the terminal, which the judge then evaluates.
 *
 * This is the simplest integration pattern: any CLI tool that
 * accepts a prompt and writes to stdout can be used as a runner.
 *
 * Prerequisites:
 *   - GitHub Copilot CLI installed
 *   - ANTHROPIC_API_KEY for the judge
 *
 * Usage:
 *   agenteval run --config evals/cli-copilot-gpt5/agenteval.config.ts
 */
export default defineConfig({
  rootDir: "../..",

  runners: [
    {
      name: "copilot-gpt5",
      command: "copilot --model=gpt-5 --prompt={{prompt}}",
    },
  ],

  // ⚠️ Use a strong model for the judge — it needs to understand code,
  // diffs, test output, and make nuanced pass/fail decisions.
  judge: {
    llm: new AnthropicModel({ model: "claude-sonnet-4-20250514" }),
  },

  // Config-level beforeEach: these tasks apply to ALL tests using this config.
  beforeEach: ({ ctx }) => {
    ctx.addTask({
      name: "Tests",
      action: () => ctx.exec("pnpm test"),
      criteria: "All existing and new tests must pass",
      weight: 3,
    });

    ctx.addTask({
      name: "Build",
      action: () => ctx.exec("pnpm build"),
      criteria: "TypeScript compilation must succeed with zero errors",
      weight: 2,
    });
  },

  testFiles: "evals/cli-copilot-gpt5/**/*.eval.ts",
  outputDir: ".agenteval",
  timeout: 120_000,
});
