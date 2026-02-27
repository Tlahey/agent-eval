# Configuration

AgentEval is configured via `agenteval.config.ts` at the root of your project.

## Full Example

```ts
import { defineConfig } from "agent-eval";

export default defineConfig({
  // Where test files are located
  testFiles: "**/*.{eval,agent-eval}.{ts,js}",

  // Agent runners to evaluate
  runners: [
    // CLI runner: any tool that accepts a prompt via command line
    {
      name: "copilot",
      type: "cli",
      command: 'gh copilot suggest -t shell "{{prompt}}"',
    },
    {
      name: "claude-code",
      type: "cli",
      command: 'claude -p "{{prompt}}" --allowedTools "Edit,Write,Bash"',
    },
    {
      name: "aider-sonnet",
      type: "cli",
      command:
        'aider --model anthropic/claude-sonnet-4-20250514 --message "{{prompt}}" --yes --no-auto-commits',
    },
    // API runner: calls an LLM directly
    {
      name: "gpt-4o-api",
      type: "api",
      api: {
        provider: "openai",
        model: "gpt-4o",
      },
    },
  ],

  // Judge configuration — use a strong, capable model
  // API judge (default):
  judge: {
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
  },

  // Or use a CLI judge:
  // judge: {
  //   type: "cli",
  //   command: 'claude -p "$(cat {{prompt_file}})" --output-format json',
  // },

  // Model matrix (optional): only run specific runners
  matrix: {
    runners: ["copilot", "claude-code"],
  },

  // Output directory for the ledger
  outputDir: ".agenteval",

  // Timeout per agent run (ms)
  timeout: 300_000,
});
```

## Options Reference

| Option      | Type                     | Default                                  | Description                        |
| ----------- | ------------------------ | ---------------------------------------- | ---------------------------------- |
| `rootDir`   | `string`                 | `process.cwd()`                          | Project root directory             |
| `testFiles` | `string \| string[]`     | `**/*.{eval,agent-eval}.{ts,js,mts,mjs}` | Glob pattern(s) for test discovery |
| `runners`   | `AgentRunnerConfig[]`    | _required_                               | Agent runners to evaluate          |
| `judge`     | `JudgeConfig`            | _required_                               | LLM judge configuration            |
| `matrix`    | `{ runners?: string[] }` | —                                        | Filter which runners to execute    |
| `outputDir` | `string`                 | `.agenteval`                             | Ledger output directory            |
| `timeout`   | `number`                 | `300000`                                 | Agent run timeout (ms)             |

## Runner Configuration

AgentEval supports two runner types. See the dedicated [Runners guide](/guide/runners) for full details and examples.

### CLI Runner

Spawns a shell command. Use `{{prompt}}` as the placeholder for the test instruction. Most CLI coding agents accept a model flag to choose which LLM to use.

```ts
// GitHub Copilot
{
  name: "copilot",
  type: "cli",
  command: 'gh copilot suggest -t shell "{{prompt}}"',
}

// Claude Code with specific tools
{
  name: "claude-code",
  type: "cli",
  command: 'claude -p "{{prompt}}" --allowedTools "Edit,Write,Bash"',
}

// Aider with model selection
{
  name: "aider-sonnet",
  type: "cli",
  command: 'aider --model anthropic/claude-sonnet-4-20250514 --message "{{prompt}}" --yes --no-auto-commits',
}

// OpenAI Codex CLI
{
  name: "codex",
  type: "cli",
  command: 'codex "{{prompt}}" --approval-mode full-auto',
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

## Judge Configuration

The judge evaluates agent output using an LLM. See the [Judges guide](/guide/judges) for scoring, per-test overrides, and provider details.

::: warning Choose a strong model
The judge must understand code, parse diffs, and interpret test output. Always use a frontier-class model (`claude-sonnet-4`, `gpt-4o`, `claude-opus-4`). Avoid small or local models — they produce unreliable evaluations.
:::

### API Judge (default)

```ts
judge: {
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
}
```

| Provider    | Package                              | Recommended Model           | Auth                |
| ----------- | ------------------------------------ | --------------------------- | ------------------- |
| `anthropic` | `@ai-sdk/anthropic`                  | `claude-sonnet-4-20250514`  | `ANTHROPIC_API_KEY` |
| `openai`    | `@ai-sdk/openai`                     | `gpt-4o`                    | `OPENAI_API_KEY`    |
| `ollama`    | `@ai-sdk/openai` (OpenAI-compatible) | ⚠️ Not recommended as judge | None (local)        |

### CLI Judge

Use any CLI tool as a judge. The command must return JSON `{ pass, score, reason }` on stdout.

```ts
// Claude CLI as judge
judge: {
  type: "cli",
  command: 'claude -p "$(cat {{prompt_file}})" --output-format json',
}

// Custom evaluation script
judge: {
  type: "cli",
  command: "python evaluate.py --prompt-file {{prompt_file}}",
}
```

Use `{{prompt_file}}` to pass the (potentially very long) prompt via a temp file, or `{{prompt}}` for inline replacement.
