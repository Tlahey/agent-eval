# defineConfig()

Type-safe helper for creating `agenteval.config.ts`.

## Signature

```ts
function defineConfig(config: AgentEvalConfig): AgentEvalConfig;
```

## Usage

```ts
// agenteval.config.ts
import { defineConfig } from "agent-eval";

export default defineConfig({
  runners: [
    {
      name: "copilot",
      type: "cli",
      command: 'gh copilot suggest "{{prompt}}"',
    },
  ],
  judge: {
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
  },
  afterEach: [
    { name: "test", command: "pnpm test" },
    { name: "typecheck", command: "pnpm build" },
  ],
});
```

## Full Type

```ts
interface AgentEvalConfig {
  rootDir?: string; // Project root (default: cwd)
  testFiles?: string | string[]; // Glob patterns for test discovery
  runners: AgentRunnerConfig[]; // Agent runners to evaluate
  judge: JudgeConfig; // LLM judge configuration
  afterEach?: AfterEachCommand[]; // Auto commands after each agent run
  matrix?: { runners?: string[] }; // Filter which runners to execute
  outputDir?: string; // Ledger output dir (default: .agenteval)
  timeout?: number; // Agent run timeout ms (default: 300000)
  ledger?: ILedgerPlugin; // Custom storage plugin
  llm?: ILLMPlugin; // Custom LLM plugin
  environment?: IEnvironmentPlugin; // Execution environment plugin
}

interface AgentRunnerConfig {
  name: string;
  type: "cli" | "api";
  command?: string; // CLI runners: shell command with {{prompt}}
  api?: {
    provider: "anthropic" | "openai" | "ollama";
    model: string;
    apiKey?: string;
    baseURL?: string;
  };
}

type JudgeConfig = JudgeApiConfig | JudgeCliConfig;

interface JudgeApiConfig {
  provider: "anthropic" | "openai" | "ollama";
  model: string;
  apiKey?: string;
  baseURL?: string;
}

interface JudgeCliConfig {
  type: "cli";
  command: string; // CLI command with {{prompt}} or {{prompt_file}}
  maxRetries?: number; // Retry on invalid JSON (default: 2)
}

interface AfterEachCommand {
  name: string; // Label for the command
  command: string; // Shell command to execute
}
```

## Config Options

| Option        | Type                     | Default                                  | Description                                                |
| ------------- | ------------------------ | ---------------------------------------- | ---------------------------------------------------------- |
| `rootDir`     | `string`                 | `process.cwd()`                          | Project root directory                                     |
| `testFiles`   | `string \| string[]`     | `**/*.{eval,agent-eval}.{ts,js,mts,mjs}` | Glob pattern(s) for test discovery                         |
| `runners`     | `AgentRunnerConfig[]`    | _required_                               | Agent runners to evaluate                                  |
| `judge`       | `JudgeConfig`            | _required_                               | LLM judge configuration                                    |
| `afterEach`   | `AfterEachCommand[]`     | —                                        | Commands to run after each agent (auto storeDiff first)    |
| `matrix`      | `{ runners?: string[] }` | —                                        | Filter which runners to execute                            |
| `outputDir`   | `string`                 | `.agenteval`                             | Ledger output directory                                    |
| `timeout`     | `number`                 | `300000`                                 | Agent run timeout (ms)                                     |
| `ledger`      | `ILedgerPlugin`          | Built-in SQLite                          | Custom storage plugin ([docs](/guide/plugin-architecture)) |
| `llm`         | `ILLMPlugin`             | Built-in Vercel AI SDK                   | Custom LLM plugin ([docs](/guide/plugin-architecture))     |
| `environment` | `IEnvironmentPlugin`     | `LocalEnvironment`                       | Execution environment ([docs](/guide/environments))        |
