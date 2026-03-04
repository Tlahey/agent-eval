import { defineConfig } from "agent-eval";
import { GitHubModelsModel, CliModel } from "agent-eval/llm";

/**
 * Runner — GitHub Models API (via models.github.ai)
 *
 * Uses the GitHubModelsModel plugin with a CLI runner for the agent.
 * The judge uses GitHub Models API with guaranteed JSON structured output.
 *
 * Prerequisites:
 *   - GH_COPILOT_TOKEN or GITHUB_TOKEN env var (get one with: gh auth token)
 *
 * Usage:
 *   agenteval run --config evals/github-models/agenteval.config.ts
 */
export default defineConfig({
  rootDir: "../..",

  runners: [
    {
      name: "copilot",
      model: new CliModel({
        command: 'gh copilot suggest "{{prompt}}"',
      }),
    },
  ],

  judge: {
    name: "gpt-5-mini",
    model: new GitHubModelsModel({
      model: "openai/gpt-5-mini",
      settings: {
        temperature: 1,
        maxTokens: 4096,
        topP: 1,
      },
    }),
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

  testFiles: "evals/github-models/**/*.eval.ts",
  outputDir: ".agenteval",
  timeout: 180_000,
});
