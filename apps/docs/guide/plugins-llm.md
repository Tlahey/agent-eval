# LLM / Model Plugins

Model plugins abstract AI provider calls for **judge evaluation** and **API-based agent runners**. They implement the `IModelPlugin` interface.

## Interface

```ts
interface IModelPlugin {
  readonly name: string;
  readonly modelId: string;
  readonly settings?: ModelSettings;
  readonly tools?: Record<string, unknown>;
  createModel(): unknown | Promise<unknown>;
}
```

The framework calls `createModel()` whenever it needs a model — for judge evaluation (`generateObject()`) or for API runners (`generateObject()` without tools, `generateText()` with tools).

## ModelSettings

Generation settings forwarded to the AI SDK at call time:

```ts
interface ModelSettings {
  temperature?: number; // 0 = deterministic, 1 = creative
  maxTokens?: number; // Max tokens in the response
  topP?: number; // Nucleus sampling (0-1)
  maxSteps?: number; // Max tool-calling rounds (default: 10)
}
```

`maxSteps` only applies when `tools` are provided — it controls how many rounds of tool calling the model can perform.

## Built-in Plugins

### AnthropicModel

Uses Anthropic's Claude models via `@ai-sdk/anthropic`.

```ts
import { defineConfig } from "@tlahey/agent-eval";
import { AnthropicModel, CliModel } from "agent-eval/llm";

export default defineConfig({
  runners: [{ id: "copilot", model: new CliModel({ command: "gh copilot -p '{{prompt}}'" }) }],
  judge: {
    id: "claude-sonnet",
    model: new AnthropicModel({ model: "claude-sonnet-4-20250514" }),
  },
});
```

| Option     | Type                      | Default             | Description                        |
| ---------- | ------------------------- | ------------------- | ---------------------------------- |
| `model`    | `string`                  | —                   | Model identifier                   |
| `apiKey`   | `string`                  | `ANTHROPIC_API_KEY` | API key (env var fallback)         |
| `baseURL`  | `string`                  | —                   | Custom API endpoint                |
| `settings` | `ModelSettings`           | —                   | Generation settings                |
| `tools`    | `Record<string, unknown>` | —                   | AI SDK tools for agentic execution |

**Recommended models:**

| Model                      | Best for              |
| -------------------------- | --------------------- |
| `claude-sonnet-4-20250514` | Best cost/performance |
| `claude-opus-4-20250514`   | Most capable          |
| `claude-haiku-3-20250305`  | Fastest, cheapest     |

---

### OpenAIModel

Uses OpenAI's GPT models via `@ai-sdk/openai`.

```ts
import { defineConfig } from "@tlahey/agent-eval";
import { OpenAIModel } from "agent-eval/llm";

const gpt4o = new OpenAIModel({ model: "gpt-4o" });

export default defineConfig({
  runners: [{ id: "gpt-4o", model: gpt4o }],
  judge: { id: "gpt-4o", model: gpt4o },
});
```

| Option     | Type                      | Default          | Description                        |
| ---------- | ------------------------- | ---------------- | ---------------------------------- |
| `model`    | `string`                  | —                | Model identifier                   |
| `apiKey`   | `string`                  | `OPENAI_API_KEY` | API key (env var fallback)         |
| `baseURL`  | `string`                  | —                | Custom API endpoint                |
| `settings` | `ModelSettings`           | —                | Generation settings                |
| `tools`    | `Record<string, unknown>` | —                | AI SDK tools for agentic execution |

**Recommended models:**

| Model           | Best for              |
| --------------- | --------------------- |
| `gpt-4o`        | Best cost/performance |
| `gpt-4-turbo`   | High capability       |
| `gpt-3.5-turbo` | Budget option         |

::: tip Custom endpoints
Use `baseURL` to connect to any OpenAI-compatible API: Azure OpenAI, Together AI, Fireworks, Groq, etc.
:::

---

### OllamaModel

Run models **locally** with [Ollama](https://ollama.ai/). No API key required.

```ts
import { defineConfig } from "@tlahey/agent-eval";
import { OllamaModel } from "agent-eval/llm";

const llama = new OllamaModel({ model: "llama3" });

export default defineConfig({
  runners: [{ name: "llama3", model: llama }],
  judge: { name: "llama3", model: llama },
});
```

| Option     | Type                      | Default                     | Description                        |
| ---------- | ------------------------- | --------------------------- | ---------------------------------- |
| `model`    | `string`                  | —                           | Model identifier                   |
| `baseURL`  | `string`                  | `http://localhost:11434/v1` | Ollama API endpoint                |
| `settings` | `ModelSettings`           | —                           | Generation settings                |
| `tools`    | `Record<string, unknown>` | —                           | AI SDK tools for agentic execution |

::: warning Not recommended as judge
Local models lack the reasoning depth for reliable code evaluation. Use them only for experimentation, not production evaluations.
:::

---

### GitHubModelsModel

Uses GitHub Models inference API (`models.github.ai`). OpenAI-compatible, with **structured JSON output** and **tool calling** support.

```ts
import { defineConfig } from "@tlahey/agent-eval";
import { GitHubModelsModel } from "agent-eval/llm";

export default defineConfig({
  runners: [
    {
      name: "gpt-5-mini",
      model: new GitHubModelsModel({
        model: "openai/gpt-5-mini",
        settings: { temperature: 1, maxTokens: 4096, topP: 1 },
      }),
    },
  ],
  judge: {
    name: "gpt-5-mini",
    model: new GitHubModelsModel({ model: "openai/gpt-5-mini" }),
  },
});
```

| Option     | Type                      | Default                                | Description                        |
| ---------- | ------------------------- | -------------------------------------- | ---------------------------------- |
| `model`    | `string`                  | `"openai/gpt-4o"`                      | Model ID (catalog format)          |
| `token`    | `string`                  | `GH_COPILOT_TOKEN` → `GITHUB_TOKEN`    | GitHub token for auth              |
| `baseURL`  | `string`                  | `"https://models.github.ai/inference"` | Inference endpoint                 |
| `settings` | `ModelSettings`           | —                                      | Generation settings                |
| `tools`    | `Record<string, unknown>` | —                                      | AI SDK tools for agentic execution |

::: tip Recommended as judge
GitHubModelsModel uses `structuredOutputs: true` which guarantees valid JSON output — ideal for the judge role.
:::

---

## Tools (Agentic Execution) {#tools}

Any `IModelPlugin` can declare **tools** — AI SDK tool definitions the model can call during execution. When tools are present, the runner switches from `generateObject()` (file schema) to `generateText()` with multi-step tool calling.

The framework passes tools directly to the [AI SDK](https://ai-sdk.dev/docs/foundations/tools). You define the tools, the model calls them. File changes are captured by `storeDiff()` via git.

### Example: API runner with tools

```ts
import { defineConfig } from "@tlahey/agent-eval";
import { GitHubModelsModel } from "agent-eval/llm";
import { tool } from "ai";
import { z } from "zod";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";

const coder = new GitHubModelsModel({
  model: "openai/gpt-5-mini",
  settings: { temperature: 0.7, maxTokens: 8192, maxSteps: 15 },
  tools: {
    readFile: tool({
      description: "Read a file from the project",
      parameters: z.object({ path: z.string() }),
      execute: async ({ path }) => readFileSync(path, "utf-8"),
    }),
    writeFile: tool({
      description: "Write content to a file",
      parameters: z.object({ path: z.string(), content: z.string() }),
      execute: async ({ path, content }) => {
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, content, "utf-8");
        return `wrote ${path}`;
      },
    }),
  },
});

export default defineConfig({
  runners: [{ name: "gpt-5-mini-agent", model: coder }],
  judge: {
    name: "gpt-5-mini",
    model: new GitHubModelsModel({ model: "openai/gpt-5-mini" }),
  },
});
```

---

## ICliModel

CLI models represent shell-based agents (aider, copilot, etc.). They implement the `ICliModel` interface instead of `IModelPlugin`.

### Interface

```ts
interface ICliModel {
  readonly type: "cli";
  readonly name: string;
  readonly command: string;
  parseOutput?: CliOutputParser;
}
```

The optional `parseOutput` callback extracts structured metrics from the CLI tool's raw output:

```ts
interface CliOutputMetrics {
  tokenUsage?: TokenUsage; // Extracted token counts
  agentOutput?: string; // Cleaned output (e.g., JSON unwrapped)
}

type CliOutputParser = (output: { stdout: string; stderr: string }) => CliOutputMetrics;
```

### Example: CliModel with Token Parsing

```ts
import { CliModel } from "agent-eval/llm";

const claudeCode = new CliModel({
  name: "claude-code",
  command: 'claude -p "{{prompt}}" --output-format json',
  parseOutput: ({ stdout }) => {
    const json = JSON.parse(stdout);
    return {
      tokenUsage: json.usage
        ? {
            inputTokens: json.usage.input_tokens,
            outputTokens: json.usage.output_tokens,
            totalTokens: json.usage.input_tokens + json.usage.output_tokens,
          }
        : undefined,
      agentOutput: json.result,
    };
  },
});
```
