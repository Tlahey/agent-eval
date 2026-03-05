import { defineConfig } from "agent-eval";
import { AnthropicModel, CliModel, OpenAIModel } from "agent-eval/llm";

/**
 * Multi-Runner — Compare multiple agents on the same eval
 *
 * This config runs THREE runners sequentially on every test:
 *   1. Claude Sonnet (API via AnthropicModel)
 *   2. GPT-4o (API via OpenAIModel)
 *   3. Aider CLI (spawns a shell command)
 *
 * Each runner executes the same prompt, then the judge scores each result
 * independently. Results are stored in the ledger for side-by-side comparison
 * via the dashboard (`agenteval ui`).
 *
 * Use `matrix.runners` to filter specific runners per run:
 *   agenteval run --config evals/multi-runner/agenteval.config.ts
 *
 * Prerequisites:
 *   - ANTHROPIC_API_KEY (runner + judge)
 *   - OPENAI_API_KEY (runner)
 *   - pip install aider-chat (CLI runner)
 *
 * Usage:
 *   agenteval run --config evals/multi-runner/agenteval.config.ts
 */

const claude = new AnthropicModel({ model: "claude-sonnet-4-20250514" });

export default defineConfig({
  rootDir: "../..",

  runners: [
    { name: "claude-sonnet", model: claude },
    { name: "gpt-4o", model: new OpenAIModel({ model: "gpt-4o" }) },
    {
      name: "aider",
      model: new CliModel({
        command:
          'aider --model anthropic/claude-sonnet-4-20250514 --message "{{prompt}}" --yes --no-auto-commits',
      }),
    },
  ],

  // Use the same model for judging all runners
  judge: {
    model: claude,
  },

  beforeEach: ({ ctx }) => {
    ctx.addTask({
      name: "Tests",
      action: ({ exec }) => exec("pnpm test"),
      criteria: "All existing and new tests must pass",
      weight: 3,
    });

    ctx.addTask({
      name: "Build",
      action: ({ exec }) => exec("pnpm build"),
      criteria: "TypeScript compilation must succeed with zero errors",
      weight: 2,
    });
  },

  // Uncomment to run only specific runners:
  // matrix: { runners: ["claude-sonnet", "gpt-4o"] },

  testFiles: "evals/multi-runner/**/*.eval.ts",
  outputDir: ".agenteval",
  timeout: 180_000,
});
