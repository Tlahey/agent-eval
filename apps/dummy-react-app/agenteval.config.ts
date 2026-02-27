import { defineConfig } from "agent-eval";

export default defineConfig({
  rootDir: ".",

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

  testFiles: "evals/**/*.eval.ts",
  outputDir: ".agenteval",
  timeout: 60_000,
});
