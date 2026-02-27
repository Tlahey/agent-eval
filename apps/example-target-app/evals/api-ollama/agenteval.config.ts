import { defineConfig } from "agent-eval";

/**
 * API Runner Example — Ollama (Local)
 *
 * Uses a local Ollama instance as the coding agent.
 * The judge still uses a cloud provider for reliable evaluation.
 * Perfect for privacy-first setups or offline development.
 *
 * Requirements:
 *   - Ollama running locally (http://localhost:11434)
 *   - A model pulled: `ollama pull llama3` or `ollama pull codellama`
 *   - ANTHROPIC_API_KEY for the judge (or swap to ollama judge too)
 *
 * Usage:
 *   agenteval run --config evals/api-ollama/agenteval.config.ts
 */
export default defineConfig({
  rootDir: "../..",

  runners: [
    {
      name: "ollama-llama3",
      type: "api",
      api: {
        provider: "ollama",
        model: "llama3",
      },
    },
  ],

  judge: {
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
  },

  testFiles: "evals/api-ollama/**/*.eval.ts",
  outputDir: ".agenteval",
  timeout: 300_000, // Local models can be slower
});
