# defineConfig()

Type-safe helper for creating `agenteval.config.ts`.

## Signature

```ts
function defineConfig(config: AgentEvalConfig): AgentEvalConfig;
```

## Usage

```ts
// agenteval.config.ts
import { defineConfig } from "@tlahey/agent-eval";
import { AnthropicModel, CliModel } from "@tlahey/agent-eval/llm";

export default defineConfig({
  // Global registry of available runners
  runners: [
    {
      id: "claude-code",
      model: new CliModel({ command: 'claude -p "{{prompt}}" --allowedTools "Edit,Write,Bash"' }),
    },
    {
      id: "sonnet",
      model: new AnthropicModel({ model: "claude-3-5-sonnet-20241022" }),
    },
  ],
  judge: {
    name: "gpt-4o-judge",
    model: new OpenAIModel({ model: "gpt-4o" }),
  },
  beforeEach: ({ ctx }) => {
    ctx.addTask({
      name: "Tests",
      action: ({ exec }) => exec("pnpm test"),
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
  runners: RunnerConfig[]; // Global registry of runners
  judge: JudgeConfig; // LLM judge configuration
  runs?: number; // Number of iterations per variant (default: 1)
  beforeEach?: HookFn; // Config-level hook before each test
  matrix?: { runners?: string[] }; // Filter which runners to execute (standard mode)
  outputDir?: string; // Ledger output dir (default: .agenteval)
  timeout?: number; // Agent run timeout ms (default: 300000)
  thresholds?: Thresholds; // Scoring thresholds { warn, fail }
  ledger?: ILedgerPlugin; // Custom storage plugin
  environment?: IEnvironmentPlugin; // Execution environment plugin
}

interface RunnerConfig {
  id: string; // Unique runner identifier (referred to in tests)
  model: LlmConfig; // Model plugin or CLI model
}

interface JudgeConfig {
  name?: string; // Human-readable name for the judge
  model?: LlmConfig; // LLM for judging (IModelPlugin | ICliModel)
  maxRetries?: number; // Retry attempts on failure (default: 2)
}

type LlmConfig = IModelPlugin | ICliModel;
```

## Config Options

| Option        | Type                 | Default                                  | Description                                                 |
| ------------- | -------------------- | ---------------------------------------- | ----------------------------------------------------------- |
| `runners`     | `RunnerConfig[]`     | _required_                               | Registry of runner resources (`{ id, model }`)              |
| `judge`       | `JudgeConfig`        | _required_                               | LLM judge configuration                                     |
| `runs`        | `number`             | `1`                                      | Number of iterations per variant (stability analysis)       |
| `testFiles`   | `string \| string[]` | `**/*.{eval,agent-eval}.{ts,js,mts,mjs}` | Glob pattern(s) for test discovery                          |
| `rootDir`     | `string`             | `process.cwd()`                          | Project root directory                                      |
| `outputDir`   | `string`             | `.agenteval`                             | Ledger output directory                                     |
| `timeout`     | `number`             | `300000`                                 | Agent run timeout (ms)                                      |
| `thresholds`  | `Thresholds`         | `{ warn: 0.8, fail: 0.5 }`               | Global scoring thresholds                                   |
| `ledger`      | `ILedgerPlugin`      | Built-in SQLite                          | Custom storage plugin ([docs](/guide/plugins-ledger))       |
| `environment` | `IEnvironmentPlugin` | `LocalEnvironment`                       | Execution environment ([docs](/guide/plugins-environments)) |
