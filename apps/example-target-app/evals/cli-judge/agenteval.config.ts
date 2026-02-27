import { defineConfig } from "agent-eval";

/**
 * CLI Judge Example
 *
 * Demonstrates using a CLI tool (Claude) as the judge instead of an API.
 * The runner uses `gh copilot suggest` and the judge uses `claude -p`
 * to evaluate the output.
 *
 * The CLI judge must return JSON: { "pass": boolean, "score": number, "reason": string }
 *
 * Use {{prompt_file}} for the judge prompt — it's too long for inline replacement.
 *
 * Prerequisites:
 *   - GitHub Copilot CLI: `gh extension install github/gh-copilot`
 *   - Claude Code CLI: https://docs.anthropic.com/en/docs/claude-code
 *
 * Usage:
 *   agenteval run --config evals/cli-judge/agenteval.config.ts
 */
export default defineConfig({
  rootDir: "../..",

  runners: [
    {
      name: "copilot",
      type: "cli",
      command: 'gh copilot suggest -t shell "{{prompt}}"',
    },
  ],

  // CLI judge — uses Claude CLI instead of an API provider.
  // The command receives the full evaluation prompt via {{prompt_file}}.
  // It must output valid JSON with { pass, score, reason }.
  judge: {
    type: "cli",
    command:
      'claude -p "Analyze the following code evaluation and respond ONLY with JSON {pass: boolean, score: number, reason: string}. $(cat {{prompt_file}})" --output-format json',
  },

  // Commands run automatically after each agent.run() call.
  // storeDiff() is always called first (built-in).
  afterEach: [
    { name: "test", command: "pnpm test" },
    { name: "typecheck", command: "pnpm build" },
  ],

  testFiles: "evals/cli-judge/**/*.eval.ts",
  outputDir: ".agenteval",
  timeout: 180_000,
});
