import { defineConfig } from "agent-eval";
import { AnthropicModel, CliModel } from "agent-eval/llm";

/**
 * Default config — runs the mock agent against ALL eval scenarios.
 *
 * For running a specific implementation, use --config:
 *
 *   # API runners (LLM via plugin)
 *   agenteval run --config evals/anthropic/agenteval.config.ts
 *   agenteval run --config evals/openai/agenteval.config.ts
 *   agenteval run --config evals/ollama/agenteval.config.ts
 *
 *   # CLI runners (spawn a command)
 *   agenteval run --config evals/cli-mock/agenteval.config.ts
 *   agenteval run --config evals/cli-copilot/agenteval.config.ts
 *   agenteval run --config evals/cli-aider/agenteval.config.ts
 *
 *   # Multi-runner (compare agents side-by-side)
 *   agenteval run --config evals/multi-runner/agenteval.config.ts
 */
export default defineConfig({
  rootDir: ".",

  runners: [
    {
      name: "mock-agent",
      model: new CliModel({ command: 'node scripts/mock-agent.mjs "{{prompt}}"' }),
    },
  ],

  // ⚠️ The judge must be a strong model capable of understanding code diffs,
  // test output, and making nuanced pass/fail decisions.
  judge: {
    model: new AnthropicModel({ model: "claude-sonnet-4-20250514" }),
  },

  testFiles: "evals/**/*.eval.ts",
  outputDir: ".agenteval",
  timeout: 60_000,
});
