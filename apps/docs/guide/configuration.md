# Configuration

AgentEval is configured via `agenteval.config.ts` at the root of your project.

## Config Resolution

```mermaid
flowchart TD
    A["agenteval run -c path/config.ts"] --> B{"--config flag?"}
    B -- Yes --> C["Load specified file"]
    B -- No --> D["Search for config file"]
    D --> E["agenteval.config.ts"]
    D --> F["agenteval.config.js"]
    D --> G["agenteval.config.mts"]
    D --> H["agenteval.config.mjs"]
    E & F & G & H --> I["jiti loader"]
    C --> I
    I --> J["Merge with defaults"]
    J --> K["Validated config ready"]

    style A fill:#4f46e5,color:#fff
    style K fill:#10b981,color:#fff
```

## Minimal Example

```ts
// agenteval.config.ts
import { defineConfig } from "@tlahey/agent-eval";
import { AnthropicModel } from "@tlahey/agent-eval/llm";

export default defineConfig({
  runners: [{ id: "sonnet", model: new AnthropicModel({ model: "claude-3-5-sonnet-20241022" }) }],
  defaultRunner: "sonnet", // Required for standard tests
  judge: {
    model: new AnthropicModel({ model: "claude-3-5-sonnet-20241022" }),
  },
});
```

## Full Example (with registry and defaults)

```ts
import { defineConfig } from "@tlahey/agent-eval";
import { AnthropicModel, CliModel, OpenAIModel } from "@tlahey/agent-eval/llm";
import { SqliteLedger } from "@tlahey/agent-eval/ledger";

export default defineConfig({
  // --- Registry of technical resources ---
  runners: [
    { id: "sonnet", model: new AnthropicModel({ model: "claude-3-5-sonnet-20241022" }) },
    { id: "gpt4", model: new OpenAIModel({ model: "gpt-4o" }) },
    { id: "aider", model: new CliModel({ command: 'aider --message "{{prompt}}" --yes' }) },
  ],

  // --- Default execution target ---
  defaultRunner: "sonnet",

  judge: {
    name: "gpt-4o-judge",
    model: new OpenAIModel({ model: "gpt-4o" }),
  },

  ledger: new SqliteLedger({ outputDir: ".agenteval" }),

  beforeEach: ({ ctx }) => {
    ctx.addTask({
      name: "Lint",
      action: ({ exec }) => exec("pnpm lint"),
      criteria: "Code follows linting rules",
    });
  },

  testFiles: "evals/**/*.eval.ts",
  timeout: 300_000,
  thresholds: { warn: 0.8, fail: 0.5 },
});
```

## Options Reference

| Option          | Type                 | Default                     | Description                                               |
| :-------------- | :------------------- | :-------------------------- | :-------------------------------------------------------- |
| `runners`       | `RunnerConfig[]`     | _required_                  | Registry of available AI agents.                          |
| `defaultRunner` | `string`             | —                           | The runner ID to use for `test()` calls without variants. |
| `judge`         | `JudgeConfig`        | _required_                  | LLM-as-a-Judge configuration.                             |
| `testFiles`     | `string \| string[]` | `**/*.{eval,agent-eval}.ts` | Glob pattern(s) for test discovery.                       |
| `rootDir`       | `string`             | `process.cwd()`             | Project root directory.                                   |
| `outputDir`     | `string`             | `.agenteval`                | Ledger output directory.                                  |
| `timeout`       | `number`             | `300000`                    | Max duration for agent mission (ms).                      |
| `thresholds`    | `Thresholds`         | `{ warn: 0.8, fail: 0.5 }`  | Global scoring thresholds.                                |
| `ledger`        | `ILedgerPlugin`      | `SqliteLedger`              | Custom storage plugin.                                    |
| `environment`   | `IEnvironmentPlugin` | `LocalEnvironment`          | Custom execution environment.                             |

## Runner Registry

Runners are defined once in the config and used by ID.

```ts
runners: [
  { id: "sonnet", model: new AnthropicModel(...) },
  { id: "gpt4", model: new OpenAIModel(...) }
]
```

### Standard Matrix Mode

To run **all** tests against **all** runners (the legacy behavior), simply omit `defaultRunner` and do not use variants in your tests. AgentEval will loop through the registry.

### Experiment Mode

If a test uses `test.variants()`, it ignores the `defaultRunner` and only uses the runners specified in its variants.

## Scoring Thresholds

AgentEval uses a three-level scoring system: **PASS**, **WARN**, and **FAIL**.

| Threshold | Default | Meaning                                                         |
| :-------- | :------ | :-------------------------------------------------------------- |
| `warn`    | `0.8`   | Scores ≥ 0.8 are **PASS**.                                      |
| `fail`    | `0.5`   | Scores ≥ 0.5 but < 0.8 are **WARN**. Scores < 0.5 are **FAIL**. |

::: tip
Only **FAIL** results throw errors and break CI. **WARN** results are recorded but considered passing.
:::
