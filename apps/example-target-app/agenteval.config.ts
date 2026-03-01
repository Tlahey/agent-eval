import { defineConfig } from "agent-eval";
import { AnthropicModel } from "agent-eval/providers/anthropic";

/**
 * Default config — runs the mock agent against ALL eval scenarios.
 *
 * For running a specific implementation, use --config:
 *
 *   # CLI agents
 *   agenteval run --config evals/cli-mock/agenteval.config.ts
 *   agenteval run --config evals/cli-copilot/agenteval.config.ts
 *   agenteval run --config evals/cli-copilot-gpt5/agenteval.config.ts
 *   agenteval run --config evals/cli-claude/agenteval.config.ts
 *   agenteval run --config evals/cli-aider/agenteval.config.ts
 *
 *   # API agents
 *   agenteval run --config evals/api-openai/agenteval.config.ts
 *   agenteval run --config evals/api-anthropic/agenteval.config.ts
 *   agenteval run --config evals/api-ollama/agenteval.config.ts
 */
export default defineConfig({
  rootDir: ".",

  runners: [
    {
      name: "mock-agent",
      command: 'node scripts/mock-agent.mjs "{{prompt}}"',
    },
  ],

  // ⚠️ The judge must be a strong model capable of understanding code diffs,
  // test output, and making nuanced pass/fail decisions.
  judge: {
    llm: new AnthropicModel({ model: "claude-sonnet-4-20250514" }),
  },

  testFiles: "evals/**/*.eval.ts",
  outputDir: ".agenteval",
  timeout: 60_000,
});
