import { defineConfig } from "agent-eval";

/**
 * API Runner Example — OpenAI
 *
 * Uses the OpenAI API (gpt-4o) as both the coding agent and the judge.
 * The agent receives a prompt and returns structured file operations.
 *
 * Requirements:
 *   - OPENAI_API_KEY environment variable set
 *
 * Usage:
 *   agenteval run --config evals/api-openai/agenteval.config.ts
 */
export default defineConfig({
  rootDir: "../..",

  runners: [
    {
      name: "openai-gpt4o",
      type: "api",
      api: {
        provider: "openai",
        model: "gpt-4o",
      },
    },
  ],

  judge: {
    provider: "openai",
    model: "gpt-4o",
  },

  testFiles: "evals/api-openai/**/*.eval.ts",
  outputDir: ".agenteval",
  timeout: 120_000,
});
