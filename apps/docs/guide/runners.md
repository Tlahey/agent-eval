# Runners

Runners define **how** AgentEval triggers an AI coding agent. There are two runner types: **CLI runners** (spawn a shell command via `CliModel`) and **API runners** (call an LLM directly via an `IModelPlugin`).

Runners are registered once in the global `agenteval.config.ts` and referred to by their `id` in tests or variants.

## Runner Types at a Glance

| Type           | How it works                     | Best for                               |
| :------------- | :------------------------------- | :------------------------------------- |
| **CLI runner** | Spawns a shell command.          | IDE agents, CLI tools, custom scripts. |
| **API runner** | Direct LLM call (zero-overhead). | Model comparison, headless CI.         |

```ts
import type { RunnerConfig } from "@tlahey/agent-eval";

interface RunnerConfig {
  id: string; // Unique ID (e.g. "sonnet", "gpt4", "aider")
  model: IModelPlugin | ICliModel;
}
```

---

## CLI Runners

CLI runners execute a shell command. Use `CliModel` from `@tlahey/agent-eval/llm`. The `{{prompt}}` placeholder is replaced with the final mission (optionally enriched) at runtime.

### Examples

#### Claude Code (Anthropic CLI)

```ts
{
  id: "claude-code",
  model: new CliModel({
    command: 'claude -p "{{prompt}}" --output-format json',
    parseOutput: ({ stdout }) => {
      const json = JSON.parse(stdout);
      return {
        tokenUsage: {
          inputTokens: json.usage.input_tokens,
          outputTokens: json.usage.output_tokens,
          totalTokens: json.usage.input_tokens + json.usage.output_tokens,
        },
        agentOutput: json.result,
      };
    },
  }),
}
```

#### Aider

```ts
{
  id: "aider",
  model: new CliModel({
    command: 'aider --message "{{prompt}}" --yes --no-auto-commits'
  }),
}
```

---

## API Runners

API runners call an LLM directly using the [Vercel AI SDK](https://sdk.vercel.ai/). The model returns a structured list of files, and AgentEval writes them to disk automatically.

An API runner is a plain config object with an `IModelPlugin` as its `model`.

### Examples

#### Anthropic (Claude 3.5 Sonnet)

```ts
import { AnthropicModel } from "@tlahey/agent-eval/llm";

{
  id: "sonnet",
  model: new AnthropicModel({ model: "claude-3-5-sonnet-20241022" }),
}
```

#### OpenAI (GPT-4o)

```ts
import { OpenAIModel } from "@tlahey/agent-eval/llm";

{
  id: "gpt4",
  model: new OpenAIModel({ model: "gpt-4o" }),
}
```

#### Ollama (Local Models)

```ts
import { OllamaModel } from "@tlahey/agent-eval/llm";

{
  id: "llama3-local",
  model: new OllamaModel({ model: "llama3" }),
}
```

---

## Token Usage Extraction

API runners (`IModelPlugin`) provide token usage automatically. For CLI runners, token usage is only available if you provide a `parseOutput` callback to extract metrics from the tool's stdout.

```ts
import type { CliOutputParser } from "@tlahey/agent-eval";

const parser: CliOutputParser = ({ stdout }) => {
  // Logic to parse your agent's specific output format
  return {
    tokenUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    agentOutput: "Cleaned output string",
  };
};
```

---

## Error Handling

If an agent execution fails (non-zero exit code or network error), the error is captured and recorded in the ledger. **A single agent failure never crashes the entire evaluation run.** You can analyze the failure logs in the Dashboard.
