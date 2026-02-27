import { defineConfig } from "agent-eval";

/**
 * API Runner Example — Anthropic
 *
 * Uses the Anthropic API (Claude) as the coding agent and the judge.
 * The agent receives a prompt and returns structured file operations.
 *
 * Requirements:
 *   - ANTHROPIC_API_KEY environment variable set
 *
 * Usage:
 *   agenteval run --config evals/api-anthropic/agenteval.config.ts
 */
export default defineConfig({
  rootDir: "../..",

  runners: [
    {
      name: "claude-sonnet",
      type: "api",
      api: {
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
      },
    },
  ],

  judge: {
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
  },

  testFiles: "evals/api-anthropic/**/*.eval.ts",
  outputDir: ".agenteval",
  timeout: 120_000,
});
