# defineConfig()

Type-safe helper for creating `agenteval.config.ts`.

## Signature

```ts
function defineConfig(config: AgentEvalConfig): AgentEvalConfig
```

## Usage

```ts
// agenteval.config.ts
import { defineConfig } from "@dkt/agent-eval";

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
});
```

## Full Type

```ts
interface AgentEvalConfig {
  rootDir?: string;
  testFiles?: string | string[];
  runners: AgentRunnerConfig[];
  judge: JudgeConfig;
  matrix?: { runners?: string[] };
  outputDir?: string;
  timeout?: number;
}
```
