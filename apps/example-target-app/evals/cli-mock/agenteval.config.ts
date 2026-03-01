import { defineConfig } from "agent-eval";

/**
 * CLI Runner Example — Mock Agent
 *
 * Uses a local script that simulates an AI agent by writing
 * predictable file changes. Great for testing the pipeline
 * without any API keys.
 *
 * Usage:
 *   agenteval run --config evals/cli-mock/agenteval.config.ts
 */
export default defineConfig({
  rootDir: "../..",

  runners: [
    {
      name: "mock-agent",
      type: "cli",
      command: 'node scripts/mock-agent.mjs "{{prompt}}"',
    },
  ],

  judge: {
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
  },

  testFiles: "evals/cli-mock/**/*.eval.ts",
  outputDir: ".agenteval",
  timeout: 60_000,
});
