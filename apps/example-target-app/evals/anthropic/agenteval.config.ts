import { defineConfig } from "agent-eval";
import { AnthropicModel } from "agent-eval/providers/anthropic";
import { OpenAIModel } from "agent-eval/providers/openai";

/**
 * Runner — Anthropic Claude Sonnet
 *
 * Uses the AnthropicModel plugin to call Claude via the Vercel AI SDK.
 * The judge uses OpenAI GPT-4o to avoid self-evaluation bias.
 *
 * Prerequisites:
 *   - ANTHROPIC_API_KEY for the runner
 *   - OPENAI_API_KEY for the judge
 *
 * Usage:
 *   agenteval run --config evals/anthropic/agenteval.config.ts
 */
export default defineConfig({
  rootDir: "../..",

  runners: [
    {
      name: "claude-sonnet",
      model: new AnthropicModel({ model: "claude-sonnet-4-20250514" }),
    },
  ],

  judge: {
    llm: new OpenAIModel({ model: "gpt-4o" }),
  },

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

  testFiles: "evals/anthropic/**/*.eval.ts",
  outputDir: ".agenteval",
  timeout: 180_000,
});
