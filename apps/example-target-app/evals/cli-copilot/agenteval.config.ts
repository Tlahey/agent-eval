import { defineConfig } from "agent-eval";

/**
 * CLI Runner — GitHub Copilot
 *
 * Uses `gh copilot` CLI to generate code changes.
 * The judge uses Claude Sonnet (recommended for code evaluation).
 *
 * Prerequisites:
 *   - GitHub CLI: https://cli.github.com/
 *   - Copilot extension: `gh extension install github/gh-copilot`
 *   - Authenticated: `gh auth login`
 *   - ANTHROPIC_API_KEY for the judge
 *
 * Usage:
 *   agenteval run --config evals/cli-copilot/agenteval.config.ts
 */
export default defineConfig({
  rootDir: "../..",

  runners: [
    {
      name: "copilot",
      type: "cli",
      command: 'gh copilot suggest -t shell "{{prompt}}"',
    },
  ],

  // ⚠️ Use a strong model for the judge — it needs to understand code,
  // diffs, test output, and make nuanced pass/fail decisions.
  judge: {
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
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

  testFiles: "evals/cli-copilot/**/*.eval.ts",
  outputDir: ".agenteval",
  timeout: 120_000,
});
