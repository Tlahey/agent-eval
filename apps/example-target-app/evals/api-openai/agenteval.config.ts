import { defineConfig } from "agent-eval";

/**
 * API Runner — OpenAI GPT-4o
 *
 * Calls OpenAI directly via Vercel AI SDK. The model returns structured
 * file operations that AgentEval writes to disk.
 *
 * The judge uses Anthropic Claude to avoid self-evaluation bias.
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

  testFiles: "evals/api-openai/**/*.eval.ts",
  outputDir: ".agenteval",
  timeout: 120_000,
});
