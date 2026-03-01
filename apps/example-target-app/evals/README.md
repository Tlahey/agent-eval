# Example Target App — Eval Scenarios

A simple React app used as a target for AgentEval evaluations. Each subdirectory in `evals/` demonstrates a different runner/judge configuration.

## Structure

```
evals/
├── anthropic/          ← Claude Sonnet via APIRunner + AnthropicModel
├── openai/             ← GPT-4o via APIRunner + OpenAIModel
├── ollama/             ← Llama3 via APIRunner + OllamaModel (local)
├── cli-copilot/        ← GitHub Copilot CLI (`gh copilot suggest`)
├── cli-aider/          ← Aider (`aider --message`)
├── cli-mock/           ← Local mock agent script (no API keys needed)
└── multi-runner/       ← Compare multiple agents on the same evals
```

## Usage

Run a specific example with `--config`:

```bash
# Mock agent (no API keys, great for testing the pipeline)
pnpm eval:mock

# API runners (direct LLM calls via plugin)
agenteval run --config evals/anthropic/agenteval.config.ts
agenteval run --config evals/openai/agenteval.config.ts
agenteval run --config evals/ollama/agenteval.config.ts

# CLI runners (spawn a shell command)
agenteval run --config evals/cli-copilot/agenteval.config.ts
agenteval run --config evals/cli-aider/agenteval.config.ts
agenteval run --config evals/cli-mock/agenteval.config.ts

# Multi-runner — compare Claude, GPT-4o, and Aider side-by-side
agenteval run --config evals/multi-runner/agenteval.config.ts

# Run all evals with the default config
pnpm eval

# View results in the dashboard
pnpm eval:view
```

## Environment Variables

| Variable            | Required by                        |
| ------------------- | ---------------------------------- |
| `ANTHROPIC_API_KEY` | `anthropic/`, `cli-aider/`, judges |
| `OPENAI_API_KEY`    | `openai/`, some judges             |
| _(none)_            | `cli-mock/` (offline)              |
| _(none)_            | `ollama/` (local Ollama)           |

## Multi-Runner Example

The `multi-runner/` directory shows how to compare multiple agents:

```ts
import { CLIRunner } from "agent-eval/runner/cli";
import { APIRunner } from "agent-eval/runner/api";
import { AnthropicModel } from "agent-eval/providers/anthropic";
import { OpenAIModel } from "agent-eval/providers/openai";

export default defineConfig({
  runners: [
    new APIRunner({
      name: "claude-sonnet",
      model: new AnthropicModel({ model: "claude-sonnet-4-20250514" }),
    }),
    new APIRunner({ name: "gpt-4o", model: new OpenAIModel({ model: "gpt-4o" }) }),
    new CLIRunner({
      name: "aider",
      command: 'aider --message "{{prompt}}" --yes --no-auto-commits',
    }),
  ],
  // Each runner executes every test → results compared in the dashboard
});
```

## Judge Recommendations

> **⚠️ Always use a capable model as the judge.**

The judge reads git diffs, test output, build logs, and must make nuanced pass/fail decisions.

**Recommended judge models:**

| Provider  | Model                      | Notes                     |
| --------- | -------------------------- | ------------------------- |
| Anthropic | `claude-sonnet-4-20250514` | Best balance quality/cost |
| Anthropic | `claude-opus-4-20250514`   | Strongest reasoning       |
| OpenAI    | `gpt-4o`                   | Strong, fast              |

**Avoid self-evaluation:** When possible, use a different provider for the runner and the judge (e.g., Claude runner → GPT-4o judge).
