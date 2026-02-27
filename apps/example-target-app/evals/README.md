# Example Target App

A simple React app used as a target for AgentEval evaluations. Each subdirectory in `evals/` demonstrates a different runner implementation.

## Structure

```
evals/
├── cli-mock/           ← CLI runner with a local mock agent (no API keys needed)
│   ├── agenteval.config.ts
│   └── banner.eval.ts
├── api-openai/         ← API runner using OpenAI GPT-4o
│   ├── agenteval.config.ts
│   └── banner.eval.ts
├── api-anthropic/      ← API runner using Anthropic Claude
│   ├── agenteval.config.ts
│   └── banner.eval.ts
└── api-ollama/         ← API runner using local Ollama
    ├── agenteval.config.ts
    └── banner.eval.ts
```

## Usage

Run a specific example with `--config`:

```bash
# Mock agent (no API keys, great for testing the pipeline)
pnpm eval:mock

# OpenAI (requires OPENAI_API_KEY)
pnpm eval:openai

# Anthropic (requires ANTHROPIC_API_KEY)
pnpm eval:anthropic

# Ollama (requires local Ollama running)
pnpm eval:ollama

# Run all evals with the default config
pnpm eval

# View results in the dashboard
pnpm eval:view
```

Or directly with the CLI:

```bash
agenteval run --config evals/cli-mock/agenteval.config.ts
agenteval run --config evals/api-openai/agenteval.config.ts
```

## Environment Variables

| Variable            | Required by          |
| ------------------- | -------------------- |
| `OPENAI_API_KEY`    | `api-openai`         |
| `ANTHROPIC_API_KEY` | `api-anthropic`      |
| _(none)_            | `cli-mock` (offline) |
| _(none)_            | `api-ollama` (local) |
