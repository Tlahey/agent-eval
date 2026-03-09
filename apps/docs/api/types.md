# Types Reference

All core types exported from `@tlahey/agent-eval`.

```ts
import type {
  LedgerEntry,
  RunnerConfig,
  TestVariant,
  ExecutionData,
  JudgmentData,
  AgentHandle,
  TestContext,
} from "@tlahey/agent-eval";
```

## RunnerConfig

A runner resource defined in the global config registry.

```ts
interface RunnerConfig {
  id: string; // Unique technical ID
  model: LlmConfig; // API Model or CLI Model
}
```

## TestVariant

A specific configuration for an A/B test iteration.

```ts
interface TestVariant {
  id: string; // Unique technical ID for this variant
  name: string; // Display name (e.g. "Gpt-4o with Persona")
  runnerId: string; // ID of the runner to use (must exist in registry)
  enrichPrompt?: string; // Prompt template with {{prompt}} placeholder
  metadata?: Record<string, any>; // Custom data for the test function
}
```

## LedgerEntry

A complete record of a single test iteration.

```ts
interface LedgerEntry {
  id?: number;
  testId: string;
  suitePath: string[];
  timestamp: string;

  // --- Experiment Context ---
  variantId?: string; // Present if run via test.variants()
  variantName?: string;
  basePrompt?: string; // Common mission prompt

  // --- Execution data ---
  agentRunner: string; // Global Runner ID
  instruction?: string; // Final prompt sent to LLM
  diff: string | null;
  changedFiles: string[];
  commands: CommandResult[];
  taskResults: TaskResult[];
  agentTokenUsage?: TokenUsage;
  timing: TimingData;
  agentOutput?: string;
  logs: string;

  // --- Judgment data ---
  judgeModel: string;
  score: number;
  pass: boolean;
  status: "PASS" | "WARN" | "FAIL";
  reason: string;
  improvement: string;
  judgeTokenUsage?: TokenUsage;
  criteria: string;
  expectedFiles?: string[];
  thresholds: Thresholds;

  durationMs: number;
  override?: ScoreOverride;
}
```

## AgentHandle

Injected into the test function.

```ts
interface AgentHandle {
  run(prompt: string): Promise<void>;
  instruct(prompt: string): void;
  readonly id: string; // Runner ID
  readonly model: string; // Model identifier
  readonly variant?: {
    // Present in A/B tests
    id: string;
    name: string;
    metadata?: Record<string, any>;
  };
}
```

## ExecutionData

```ts
interface ExecutionData {
  instruction: string;
  runner: { id: string; model: string };
  diff: string | null;
  changedFiles: string[];
  commands: CommandResult[];
  taskResults: TaskResult[];
  tokenUsage?: TokenUsage;
  timing: TimingData;
  agentOutput?: string;
  logs: string;
}
```
