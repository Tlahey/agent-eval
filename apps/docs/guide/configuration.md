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
    // CLI runner: spawns a shell command
    {
      name: "aider",
      type: "cli",
      command: 'aider --message "{{prompt}}" --yes --no-auto-commits',
    },
    // API runner: calls an LLM directly
    {
      name: "claude-api",
      type: "api",
      api: {
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
      },
    },
  ],

  // Judge configuration
  judge: {
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
  },

  // Model matrix (optional): only run specific runners
  matrix: {
    runners: ["aider"],
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

AgentEval supports two runner types. See the dedicated [Runners guide](/guide/runners) for full details and examples.

### CLI Runner

Spawns a shell command. Use `{{prompt}}` as the placeholder for the test instruction.

```ts
{
  name: "aider",
  type: "cli",
  command: 'aider --message "{{prompt}}" --yes --no-auto-commits',
}
```

### API Runner

Calls an LLM directly via the Vercel AI SDK. The model returns structured file operations.

```ts
{
  name: "claude-api",
  type: "api",
  api: {
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    // apiKey: "sk-ant-...",   // or use ANTHROPIC_API_KEY env var
    // baseURL: "https://...", // optional custom endpoint
  },
}
```

## Judge Providers

The judge evaluates agent output using an LLM. See the [Judges guide](/guide/judges) for scoring, per-test overrides, and provider details.

| Provider    | Package                              | Example Model              | Auth                |
| ----------- | ------------------------------------ | -------------------------- | ------------------- |
| `anthropic` | `@ai-sdk/anthropic`                  | `claude-sonnet-4-20250514` | `ANTHROPIC_API_KEY` |
| `openai`    | `@ai-sdk/openai`                     | `gpt-4o`                   | `OPENAI_API_KEY`    |
| `ollama`    | `@ai-sdk/openai` (OpenAI-compatible) | `llama3`                   | None (local)        |
