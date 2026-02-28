# Runners

Runners define **how** AgentEval triggers an AI coding agent. There are two types: **CLI runners** (spawn a shell command) and **API runners** (call an LLM directly via the Vercel AI SDK).

You can mix both types in the same config to compare CLI agents against API agents on identical tasks.

## Runner Types at a Glance

| Type  | How it works                                         | Best for                              |
| ----- | ---------------------------------------------------- | ------------------------------------- |
| `cli` | Spawns a shell command with `{{prompt}}` placeholder | IDE agents, CLI tools, custom scripts |
| `api` | Calls an LLM via Vercel AI SDK `generateObject()`    | Direct model comparison, headless CI  |

---

## CLI Runners

CLI runners execute a shell command. The `{{prompt}}` placeholder is replaced with the test instruction at runtime. The agent is expected to modify files on disk.

```ts
{
  name: "my-agent",
  type: "cli",
  command: 'my-agent-cli "{{prompt}}"',
}
```

### Available CLI Agent Examples

#### GitHub Copilot CLI

```ts
{
  name: "copilot-cli",
  type: "cli",
  command: 'gh copilot suggest -t shell "{{prompt}}"',
}
```

::: info Prerequisites
Install the [GitHub CLI](https://cli.github.com/) and authenticate with `gh auth login`. The Copilot extension is required: `gh extension install github/gh-copilot`.
:::

#### Aider

[Aider](https://aider.chat/) is an AI pair programming tool that works in your terminal.

```ts
{
  name: "aider-sonnet",
  type: "cli",
  command: 'aider --message "{{prompt}}" --yes --no-auto-commits',
}
```

::: tip
Use `--no-auto-commits` so AgentEval captures the raw diff before any commit. Use `--yes` to skip confirmation prompts.
:::

#### Cursor (via CLI)

[Cursor](https://cursor.sh/) can be invoked via its CLI for headless agent runs.

```ts
{
  name: "cursor",
  type: "cli",
  command: 'cursor --agent "{{prompt}}"',
}
```

#### Cline (VS Code Extension CLI)

[Cline](https://github.com/cline/cline) can be triggered headlessly via its CLI mode.

```ts
{
  name: "cline",
  type: "cli",
  command: 'cline --task "{{prompt}}"',
}
```

#### Claude Code (Anthropic CLI)

[Claude Code](https://docs.anthropic.com/en/docs/claude-code) is Anthropic's official agentic coding tool.

```ts
{
  name: "claude-code",
  type: "cli",
  command: 'claude -p "{{prompt}}" --allowedTools "Edit,Write,Bash"',
}
```

#### OpenAI Codex CLI

```ts
{
  name: "codex",
  type: "cli",
  command: 'codex "{{prompt}}" --approval-mode full-auto',
}
```

#### Custom Script

You can wrap any logic in a script and use it as a runner:

```ts
{
  name: "custom-agent",
  type: "cli",
  command: 'node ./scripts/my-agent.mjs "{{prompt}}"',
}
```

Your script receives the prompt as a CLI argument and should modify files in the current working directory. See `apps/example-target-app/scripts/mock-agent.mjs` for an example.

---

## API Runners

API runners call an LLM directly using the [Vercel AI SDK](https://sdk.vercel.ai/). The model returns a structured `files[]` array, and AgentEval writes them to disk.

This is useful when you want to:

- Compare raw model capabilities without agent tooling overhead
- Run evaluations in CI without installing CLI agents
- Benchmark different models on the same task

```ts
{
  name: "claude-api",
  type: "api",
  api: {
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
  },
}
```

### Supported API Providers

#### Anthropic

```ts
{
  name: "claude-sonnet",
  type: "api",
  api: {
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    // apiKey: "sk-ant-...",  // or use ANTHROPIC_API_KEY env var
  },
}
```

| Model                      | Notes                |
| -------------------------- | -------------------- |
| `claude-sonnet-4-20250514` | Best cost/perf ratio |
| `claude-opus-4-20250514`   | Most capable         |
| `claude-haiku-3-20250305`  | Fastest, cheapest    |

#### OpenAI

```ts
{
  name: "gpt-4o",
  type: "api",
  api: {
    provider: "openai",
    model: "gpt-4o",
    // apiKey: "sk-...",  // or use OPENAI_API_KEY env var
  },
}
```

| Model           | Notes                |
| --------------- | -------------------- |
| `gpt-4o`        | Best cost/perf ratio |
| `gpt-4-turbo`   | High capability      |
| `gpt-3.5-turbo` | Fast, budget option  |

#### Ollama (Local)

Run models locally with [Ollama](https://ollama.ai/). No API key required.

```ts
{
  name: "llama3-local",
  type: "api",
  api: {
    provider: "ollama",
    model: "llama3",
    baseURL: "http://localhost:11434/v1", // default
  },
}
```

| Model            | Notes                  |
| ---------------- | ---------------------- |
| `llama3`         | Meta's open model      |
| `codellama`      | Code-specialized       |
| `deepseek-coder` | Strong code generation |
| `mistral`        | Fast, general-purpose  |

::: info
Start Ollama before running: `ollama serve`. Pull models with `ollama pull llama3`.
:::

### Custom API Endpoint

Any OpenAI-compatible API can be used via the `openai` provider with a custom `baseURL`:

```ts
{
  name: "company-llm",
  type: "api",
  api: {
    provider: "openai",
    model: "internal-model-v2",
    baseURL: "https://llm.internal.company.com/v1",
    apiKey: process.env.INTERNAL_LLM_KEY,
  },
}
```

This works with Azure OpenAI, Together AI, Fireworks, Groq, and any provider exposing an OpenAI-compatible API.

---

## How API Runners Work

```mermaid
sequenceDiagram
    participant AE as AgentEval
    participant LLM as LLM API
    participant FS as File System
    participant Git as Git

    AE->>LLM: generateObject(prompt, Zod schema)
    LLM-->>AE: { files: [{ path, content }] }
    loop For each file
        AE->>FS: writeFileSync(path, content)
    end
    AE->>Git: storeDiff() [automatic]
    Git-->>AE: diff captured
```

1. AgentEval sends the test prompt to the model via `generateObject()` with a Zod schema
2. The model returns structured output: `{ files: [{ path, content }] }`
3. AgentEval writes each file to disk in the project directory
4. `storeDiff()` is called automatically, followed by any `afterEach` commands

---

## CLI vs API Runner Comparison

```mermaid
flowchart LR
    subgraph CLI["CLI Runner"]
        A["execSync(command)"] --> B["Agent modifies files"]
        B --> C["storeDiff()"]
    end

    subgraph API["API Runner"]
        D["generateObject(prompt)"] --> E["Returns files[] JSON"]
        E --> F["Write files to disk"]
        F --> G["storeDiff()"]
    end

    style CLI fill:#f0f4ff
    style API fill:#f0fdf4
```

| Aspect        | CLI Runner               | API Runner                    |
| ------------- | ------------------------ | ----------------------------- |
| **Execution** | Spawns shell command     | HTTP API call                 |
| **Agent**     | IDE agents, CLI tools    | Raw LLM models                |
| **Timeout**   | 600s default             | Network-dependent             |
| **Output**    | Agent writes files       | AgentEval writes from JSON    |
| **CI**        | Needs agent installed    | Only needs API key            |
| **Use case**  | Real-world agent testing | Model comparison, headless CI |

---

## Environment Variables

API runners use environment variables for authentication:

| Provider    | Variable            | Notes                            |
| ----------- | ------------------- | -------------------------------- |
| `anthropic` | `ANTHROPIC_API_KEY` | Or set `apiKey` in runner config |
| `openai`    | `OPENAI_API_KEY`    | Or set `apiKey` in runner config |
| `ollama`    | —                   | No key needed (local)            |

You can also use a `.env` file — AgentEval loads it automatically via the config file (since it's a TypeScript file, you can use `dotenv` or `process.env`).

---

## Error Handling

| Scenario                  | Behavior                                  |
| ------------------------- | ----------------------------------------- |
| Command not found         | Error logged, test recorded as FAIL       |
| Agent timeout (600s)      | Process killed, test recorded as FAIL     |
| API rate limit            | Error thrown, test recorded as FAIL       |
| Non-zero exit code        | Captured in context, available to judge   |
| Agent produces no changes | Empty diff, judge evaluates (likely FAIL) |

::: tip
A failing agent execution never crashes the entire run. Each test is wrapped in a try/catch, and failures are recorded in the ledger for later analysis.
:::

---

## Comparing Runners

Use the `matrix` option to select which runners to execute per run:

```ts
export default defineConfig({
  runners: [
    {
      name: "claude-api",
      type: "api",
      api: { provider: "anthropic", model: "claude-sonnet-4-20250514" },
    },
    { name: "gpt-4o-api", type: "api", api: { provider: "openai", model: "gpt-4o" } },
    { name: "aider", type: "cli", command: 'aider --message "{{prompt}}" --yes --no-auto-commits' },
  ],

  // Run all three on every test
  // Or filter to specific runners:
  // matrix: { runners: ["claude-api", "gpt-4o-api"] },
});
```

The [dashboard](/guide/dashboard) Analytics page plots score-over-time per runner, making it easy to compare agent performance.
