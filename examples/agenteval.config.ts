// Example: agenteval.config.ts
import { defineConfig } from "@dkt/agent-eval";

export default defineConfig({
  // Define the AI agents you want to evaluate
  runners: [
    {
      name: "copilot-cli",
      type: "cli",
      command: 'gh copilot suggest "{{prompt}}"',
    },
    // Add more runners to compare:
    // {
    //   name: "aider",
    //   type: "cli",
    //   command: 'aider --message "{{prompt}}" --yes',
    // },
  ],

  // Configure the LLM judge
  judge: {
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    // apiKey: "sk-...",  // Or use ANTHROPIC_API_KEY env var
  },

  // Test file discovery
  testFiles: "**/*.eval.ts",

  // Where to store results
  outputDir: ".agenteval",

  // Agent timeout (5 min)
  timeout: 300_000,
});
