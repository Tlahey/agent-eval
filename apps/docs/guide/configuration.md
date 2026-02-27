# Configuration

AgentEval is configured via `agenteval.config.ts` at the root of your project.

## Full Example

```ts
import { defineConfig } from "agent-eval";

export default defineConfig({
  // Where test files are located
  testFiles: "**/*.eval.{ts,js}",

  // Agent runners to evaluate
  runners: [
    {
      name: "copilot-cli",
      type: "cli",
      command: 'gh copilot suggest "{{prompt}}"',
    },
    {
      name: "aider",
      type: "cli",
      command: 'aider --message "{{prompt}}" --yes',
    },
  ],

  // Judge configuration
  judge: {
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
  },

  // Model matrix (optional): only run specific runners
  matrix: {
    runners: ["copilot-cli"],
  },

  // Output directory for the ledger
  outputDir: ".agenteval",

  // Timeout per agent run (ms)
  timeout: 300_000,
});
```

## Options Reference

| Option      | Type                     | Default                     | Description                        |
| ----------- | ------------------------ | --------------------------- | ---------------------------------- |
| `rootDir`   | `string`                 | `process.cwd()`             | Project root directory             |
| `testFiles` | `string \| string[]`     | `**/*.eval.{ts,js,mts,mjs}` | Glob pattern(s) for test discovery |
| `runners`   | `AgentRunnerConfig[]`    | _required_                  | Agent runners to evaluate          |
| `judge`     | `JudgeConfig`            | _required_                  | LLM judge configuration            |
| `matrix`    | `{ runners?: string[] }` | —                           | Filter which runners to execute    |
| `outputDir` | `string`                 | `.agenteval`                | Ledger output directory            |
| `timeout`   | `number`                 | `300000`                    | Agent run timeout (ms)             |

## Runner Configuration

### CLI Runner

```ts
{
  name: "my-agent",
  type: "cli",
  command: 'my-agent-cli "{{prompt}}"',
}
```

The `{{prompt}}` placeholder is replaced with the test prompt at runtime.

## Judge Providers

| Provider    | Package                              | Example Model              |
| ----------- | ------------------------------------ | -------------------------- |
| `anthropic` | `@ai-sdk/anthropic`                  | `claude-sonnet-4-20250514` |
| `openai`    | `@ai-sdk/openai`                     | `gpt-4o`                   |
| `ollama`    | `@ai-sdk/openai` (OpenAI-compatible) | `llama3`                   |
