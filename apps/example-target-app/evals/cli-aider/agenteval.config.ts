import { defineConfig } from "agent-eval";

/**
 * CLI Runner — Aider
 *
 * Uses Aider (https://aider.chat/) as the coding agent.
 * --yes skips confirmation prompts, --no-auto-commits lets AgentEval
 * capture the raw diff before any commit.
 *
 * You can swap the model with --model:
 *   aider --model anthropic/claude-sonnet-4-20250514 --message "..." --yes --no-auto-commits
 *   aider --model openai/gpt-4o --message "..." --yes --no-auto-commits
 *
 * Prerequisites:
 *   - pip install aider-chat
 *   - ANTHROPIC_API_KEY or OPENAI_API_KEY (depending on model)
 *   - ANTHROPIC_API_KEY for the judge
 *
 * Usage:
 *   agenteval run --config evals/cli-aider/agenteval.config.ts
 */
export default defineConfig({
  rootDir: "../..",

  runners: [
    {
      name: "aider-sonnet",
      type: "cli",
      command:
        'aider --model anthropic/claude-sonnet-4-20250514 --message "{{prompt}}" --yes --no-auto-commits',
    },
  ],

  // ⚠️ The judge must be a capable model. It reads git diffs, test output,
  // and build logs to make nuanced pass/fail decisions.
  judge: {
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
  },

  testFiles: "evals/cli-aider/**/*.eval.ts",
  outputDir: ".agenteval",
  timeout: 180_000,
});
