import { defineConfig } from "agent-eval";
import { AnthropicModel, OllamaModel } from "agent-eval/llm";

/**
 * Runner — Ollama (Local)
 *
 * Runs a local model via Ollama. Privacy-first: no code leaves your machine.
 * The judge uses Anthropic Claude because local models are generally not
 * capable enough to act as reliable judges for code evaluation.
 *
 * Prerequisites:
 *   - Ollama running: `ollama serve`
 *   - Model pulled: `ollama pull llama3` or `ollama pull codellama`
 *   - ANTHROPIC_API_KEY for the judge
 *
 * Usage:
 *   agenteval run --config evals/ollama/agenteval.config.ts
 */
export default defineConfig({
  rootDir: "../..",

  runners: [
    {
      name: "ollama-llama3",
      model: new OllamaModel({ model: "llama3" }),
    },
  ],

  judge: {
    model: new AnthropicModel({ model: "claude-sonnet-4-20250514" }),
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

  testFiles: "evals/ollama/**/*.eval.ts",
  outputDir: ".agenteval",
  timeout: 300_000,
});
