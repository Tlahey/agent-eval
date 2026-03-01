import { defineConfig } from "agent-eval";

/**
 * API Runner — OpenAI GPT-4o
 *
 * Calls OpenAI directly via Vercel AI SDK. The model returns structured
 * file operations that AgentEval writes to disk.
 *
 * The judge uses Anthropic Claude to avoid self-evaluation bias.
 *
 * This example demonstrates config-level beforeEach: common verification
 * tasks (build, test) are defined HERE in the config, so eval files
 * only need to declare the agent instruction and test-specific tasks.
 *
 * Prerequisites:
 *   - OPENAI_API_KEY for the runner
 *   - ANTHROPIC_API_KEY for the judge
 *
 * Usage:
 *   agenteval run --config evals/api-openai/agenteval.config.ts
 */
export default defineConfig({
  rootDir: "../..",

  runners: [
    {
      name: "gpt-4o",
      type: "api",
      api: {
        provider: "openai",
        model: "gpt-4o",
      },
    },
  ],

  // ⚠️ Use a different provider than the runner to avoid self-evaluation bias.
  judge: {
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
  },

  // Config-level beforeEach: these tasks apply to ALL tests using this config.
  // This keeps eval files focused on the agent instruction and test-specific tasks.
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

  testFiles: "evals/api-openai/**/*.eval.ts",
  outputDir: ".agenteval",
  timeout: 120_000,
});
