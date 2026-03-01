# Plugins

AgentEval uses a **plugin architecture** that decouples storage, LLM providers, and execution environments. This lets you swap backends without touching your test code.

## Overview

```mermaid
flowchart TB
    CONFIG["defineConfig()"] --> RUNNER["Runner"]

    subgraph Plugins["Three Plugin Axes"]
        direction LR
        LLM["🤖 LLM Plugin\n(Models)"]
        LEDGER["📦 Ledger Plugin\n(Storage)"]
        ENV["🖥️ Environment Plugin\n(Execution)"]
    end

    RUNNER --> LLM
    RUNNER --> LEDGER
    RUNNER --> ENV

    LLM --> AN["AnthropicLLM"]
    LLM --> OA["OpenAILLM"]
    LLM --> OL["OllamaLLM"]
    LLM --> CL["Custom LLM"]

    LEDGER --> SQ["SqliteLedger"]
    LEDGER --> JS["JsonLedger"]
    LEDGER --> CU["Custom Ledger"]

    ENV --> LE["LocalEnvironment"]
    ENV --> DE["DockerEnvironment"]
    ENV --> CE["Custom Environment"]

    style CONFIG fill:#4f46e5,color:#fff
    style Plugins fill:#f0f4ff
    style LLM fill:#6366f1,color:#fff
    style LEDGER fill:#6366f1,color:#fff
    style ENV fill:#6366f1,color:#fff
    style AN fill:#10b981,color:#fff
    style OA fill:#10b981,color:#fff
    style OL fill:#10b981,color:#fff
    style SQ fill:#10b981,color:#fff
    style JS fill:#10b981,color:#fff
    style LE fill:#10b981,color:#fff
    style DE fill:#10b981,color:#fff
```

## Plugin Categories

| Plugin          | Purpose                              | Default            | Alternatives                             |
| --------------- | ------------------------------------ | ------------------ | ---------------------------------------- |
| **LLM**         | Judge evaluation & API runners       | Vercel AI SDK      | `AnthropicLLM`, `OpenAILLM`, `OllamaLLM` |
| **Ledger**      | Result storage & querying            | `SqliteLedger`     | `JsonLedger`, custom                     |
| **Environment** | Workspace setup, command exec, diffs | `LocalEnvironment` | `DockerEnvironment`, custom              |

## Quick Configuration

```ts
import { defineConfig, OpenAILLM, SqliteLedger, LocalEnvironment } from "agent-eval";

export default defineConfig({
  // 🤖 LLM plugin — used for judge + API runners
  llm: new OpenAILLM({ defaultModel: "gpt-4o" }),

  // 📦 Ledger plugin — where results are stored
  ledger: new SqliteLedger({ outputDir: ".agenteval" }),

  // 🖥️ Environment plugin — how tests execute
  environment: new LocalEnvironment(),

  runners: [
    /* ... */
  ],
  judge: { provider: "openai", model: "gpt-4o" },
});
```

::: tip Default behavior
If you don't configure any plugins, AgentEval uses sensible defaults:

- **LLM**: Built-in Vercel AI SDK (reads `judge.provider` from config)
- **Ledger**: `SqliteLedger` with `outputDir: ".agenteval"`
- **Environment**: `LocalEnvironment` (git reset + local exec)
  :::

## Plugin Interfaces

All plugins implement a typed interface. See the detailed pages for each:

- **[LLM / Models](./plugins-llm)** — `ILLMPlugin` for judge evaluation and API-based runners
- **[Ledger / Storage](./plugins-ledger)** — `ILedgerPlugin` for result persistence and querying
- **[Environments](./plugins-environments)** — `IEnvironmentPlugin` for workspace isolation and command execution

## Plugin Validation

AgentEval validates plugins at startup. Missing or invalid methods produce clear error messages:

```
❌ Plugin validation failed:

  LLMPlugin "my-custom-llm":
    ✗ Missing method: evaluate (expected: method)

  EnvironmentPlugin "my-env":
    ✗ Missing method: setup (expected: method)
    ✗ Missing method: getDiff (expected: method)
```

## Creating Custom Plugins

Each plugin category has a typed interface you can implement:

```ts
import type { ILLMPlugin, ILedgerPlugin, IEnvironmentPlugin } from "agent-eval";

// Implement one or more interfaces
class MyLLM implements ILLMPlugin {
  /* ... */
}
class MyLedger implements ILedgerPlugin {
  /* ... */
}
class MyEnv implements IEnvironmentPlugin {
  /* ... */
}
```

See each plugin page for complete interface definitions and examples.

## Dependency Flow

```mermaid
flowchart TB
    CONFIG["defineConfig()"] --> RUNNER["Runner"]
    CONFIG --> CLI["CLI"]

    RUNNER -->|"config.llm"| LLM["ILLMPlugin"]
    RUNNER -->|"config.ledger"| LEDGER["ILedgerPlugin"]
    RUNNER -->|"config.environment"| ENV["IEnvironmentPlugin"]
    CLI -->|"config.ledger"| LEDGER

    LLM -->|"fallback"| VERCEL["Built-in Vercel AI SDK"]
    LEDGER -->|"fallback"| SQLITE["Built-in SqliteLedger"]
    ENV -->|"fallback"| LOCAL["Built-in LocalEnvironment"]

    style CONFIG fill:#4f46e5,color:#fff
    style RUNNER fill:#6366f1,color:#fff
    style CLI fill:#6366f1,color:#fff
    style LLM fill:#f59e0b,color:#000
    style LEDGER fill:#f59e0b,color:#000
    style ENV fill:#f59e0b,color:#000
    style VERCEL fill:#10b981,color:#fff
    style SQLITE fill:#10b981,color:#fff
    style LOCAL fill:#10b981,color:#fff
```
