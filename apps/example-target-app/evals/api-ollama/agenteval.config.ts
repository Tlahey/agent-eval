import { defineConfig } from "agent-eval";

/**
 * API Runner — Ollama (Local)
 *
 * Runs a local model via Ollama. Privacy-first: no code leaves your machine.
 *
 * The judge uses Anthropic Claude because local models are generally not
 * capable enough to act as reliable judges for code evaluation.
 *
 * Prerequisites:
 *   - Ollama running: `ollama serve`
 *   - Model pulled: `ollama pull llama3` or `ollama pull codellama`
 *   - ANTHROPIC_API_KEY for the judge
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
        // baseURL: "http://localhost:11434/v1",  // default
      },
    },
  ],

  // ⚠️ Always use a strong cloud model as judge, even with local runners.
  // Local models lack the reasoning depth to reliably evaluate code quality.
  judge: {
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
  },

  testFiles: "evals/api-ollama/**/*.eval.ts",
  outputDir: ".agenteval",
  timeout: 300_000, // Local models can be slower
});
