import { defineConfig } from "agent-eval";

/**
 * API Runner — Anthropic Claude Sonnet
 *
 * Calls Anthropic directly via Vercel AI SDK.
 *
 * The judge uses OpenAI GPT-4o to avoid self-evaluation bias.
 *
 * Prerequisites:
 *   - ANTHROPIC_API_KEY for the runner
 *   - OPENAI_API_KEY for the judge
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

  // ⚠️ Use a different provider than the runner to avoid self-evaluation bias.
  judge: {
    provider: "openai",
    model: "gpt-4o",
  },

  testFiles: "evals/api-anthropic/**/*.eval.ts",
  outputDir: ".agenteval",
  timeout: 120_000,
});
