import { defineConfig } from "agent-eval";
import { OpenAIModel } from "agent-eval/providers/openai";
import { AnthropicModel } from "agent-eval/providers/anthropic";

/**
 * Runner — OpenAI GPT-4o
 *
 * Uses the OpenAIModel plugin to call GPT-4o via the Vercel AI SDK.
 * The judge uses Anthropic Claude to avoid self-evaluation bias.
 *
 * Prerequisites:
 *   - OPENAI_API_KEY for the runner
 *   - ANTHROPIC_API_KEY for the judge
 *
 * Usage:
 *   agenteval run --config evals/openai/agenteval.config.ts
 */
export default defineConfig({
  rootDir: "../..",

  runners: [
    {
      name: "gpt-4o",
      model: new OpenAIModel({ model: "gpt-4o" }),
    },
  ],

  judge: {
    llm: new AnthropicModel({ model: "claude-sonnet-4-20250514" }),
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

  testFiles: "evals/openai/**/*.eval.ts",
  outputDir: ".agenteval",
  timeout: 180_000,
});
