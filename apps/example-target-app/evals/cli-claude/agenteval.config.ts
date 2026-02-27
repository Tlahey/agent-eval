import { defineConfig } from "agent-eval";

/**
 * CLI Runner — Claude Code (Anthropic)
 *
 * Uses the `claude` CLI to generate code changes in agentic mode.
 * The judge uses OpenAI GPT-4o to avoid self-evaluation bias
 * (different provider for runner vs judge).
 *
 * Prerequisites:
 *   - Claude Code CLI: https://docs.anthropic.com/en/docs/claude-code
 *   - Authenticated via `claude auth`
 *   - OPENAI_API_KEY for the judge
 *
 * Usage:
 *   agenteval run --config evals/cli-claude/agenteval.config.ts
 */
export default defineConfig({
  rootDir: "../..",

  runners: [
    {
      name: "claude-code",
      type: "cli",
      command: 'claude -p "{{prompt}}" --allowedTools "Edit,Write,Bash"',
    },
  ],

  // ⚠️ Use a different provider than the runner to avoid self-evaluation bias.
  // A strong model is essential — the judge must parse diffs, understand test
  // output, and evaluate code quality with nuance.
  judge: {
    provider: "openai",
    model: "gpt-4o",
  },

  // Commands run automatically after each agent.run() call.
  // storeDiff() is always called first (built-in).
  afterEach: [
    { name: "test", command: "pnpm test" },
    { name: "typecheck", command: "pnpm build" },
  ],

  testFiles: "evals/cli-claude/**/*.eval.ts",
  outputDir: ".agenteval",
  timeout: 180_000,
});
