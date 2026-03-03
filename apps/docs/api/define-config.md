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
import { AnthropicModel, CliModel } from "agent-eval/llm";

export default defineConfig({
  runners: [
    { name: "copilot", model: new CliModel({ command: 'gh copilot suggest "{{prompt}}"' }) },
  ],
  judge: {
    model: new AnthropicModel({ model: "claude-sonnet-4-20250514" }),
  },
  beforeEach: ({ ctx }) => {
    ctx.addTask({
      name: "Tests",
      action: () => ctx.exec("pnpm test"),
      criteria: "All tests must pass",
      weight: 3,
    });
  },
});
```

## Full Type

```ts
interface AgentEvalConfig {
  rootDir?: string; // Project root (default: cwd)
  testFiles?: string | string[]; // Glob patterns for test discovery
  runners: RunnerConfig[]; // Runner config objects
  judge: JudgeConfig; // LLM judge configuration
  beforeEach?: HookFn; // Config-level hook before each test
  afterEach?: AfterEachCommand[]; // Auto commands after each agent run
  matrix?: { runners?: string[] }; // Filter which runners to execute
  outputDir?: string; // Ledger output dir (default: .agenteval)
  timeout?: number; // Agent run timeout ms (default: 300000)
  thresholds?: Thresholds; // Scoring thresholds { warn, fail }
  ledger?: ILedgerPlugin; // Custom storage plugin
  environment?: IEnvironmentPlugin; // Execution environment plugin
}

// Runner config — plain object with a name and model
interface RunnerConfig {
  name: string; // Unique runner identifier
  model: LlmConfig; // Model or CLI model
}

interface ICliModel {
  readonly command: string; // Shell command with {{prompt}} placeholder
}

interface JudgeConfig {
  name?: string; // Human-readable name for the judge
  model?: LlmConfig; // LLM for judging (IModelPlugin | ICliModel)
  maxRetries?: number; // Retry attempts on failure (default: 2)
}

// Shared model type for runners and judge
type LlmConfig = IModelPlugin | ICliModel;

// Plugin interfaces
interface IModelPlugin {
  readonly name: string;
  readonly modelId: string;
  createModel(): unknown | Promise<unknown>;
}

interface AfterEachCommand {
  name: string; // Label for the command
  command: string; // Shell command to execute
}
```

## Config Options

| Option        | Type                     | Default                                  | Description                                                 |
| ------------- | ------------------------ | ---------------------------------------- | ----------------------------------------------------------- |
| `rootDir`     | `string`                 | `process.cwd()`                          | Project root directory                                      |
| `testFiles`   | `string \| string[]`     | `**/*.{eval,agent-eval}.{ts,js,mts,mjs}` | Glob pattern(s) for test discovery                          |
| `runners`     | `RunnerConfig[]`         | _required_                               | Runner config objects (`{ name, model }`)                   |
| `judge`       | `JudgeConfig`            | _required_                               | LLM judge configuration (`{ name, model }`)                 |
| `beforeEach`  | `HookFn`                 | —                                        | Config-level hook before each test                          |
| `afterEach`   | `AfterEachCommand[]`     | —                                        | Commands to run after each agent (auto storeDiff first)     |
| `matrix`      | `{ runners?: string[] }` | —                                        | Filter which runners to execute                             |
| `outputDir`   | `string`                 | `.agenteval`                             | Ledger output directory                                     |
| `timeout`     | `number`                 | `300000`                                 | Agent run timeout (ms)                                      |
| `thresholds`  | `Thresholds`             | `{ warn: 0.8, fail: 0.5 }`               | Scoring thresholds                                          |
| `ledger`      | `ILedgerPlugin`          | Built-in SQLite                          | Custom storage plugin ([docs](/guide/plugins-ledger))       |
| `environment` | `IEnvironmentPlugin`     | `LocalEnvironment`                       | Execution environment ([docs](/guide/plugins-environments)) |
