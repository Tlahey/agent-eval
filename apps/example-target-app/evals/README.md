# Example Target App — Eval Scenarios

A simple React app used as a target for AgentEval evaluations. Each subdirectory in `evals/` demonstrates a different runner/judge configuration.

## Structure

```
evals/
├── cli-mock/           ← Local mock agent script (no API keys needed)
├── cli-copilot/        ← GitHub Copilot CLI (`gh copilot suggest`)
├── cli-claude/         ← Claude Code CLI (`claude -p`)
├── cli-aider/          ← Aider (`aider --message`)
├── api-openai/         ← OpenAI GPT-4o via API
├── api-anthropic/      ← Anthropic Claude via API
└── api-ollama/         ← Ollama local model via API
```

## Usage

Run a specific example with `--config`:

```bash
# Mock agent (no API keys, great for testing the pipeline)
pnpm eval:mock

# CLI agents (real coding tools)
pnpm eval:copilot      # GitHub Copilot
pnpm eval:claude        # Claude Code
pnpm eval:aider         # Aider

# API agents (direct LLM calls)
pnpm eval:openai        # OpenAI GPT-4o
pnpm eval:anthropic     # Anthropic Claude
pnpm eval:ollama        # Ollama (local)

# Run all evals with the default config
pnpm eval

# View results in the dashboard
pnpm eval:view
```

Or directly with the CLI:

```bash
agenteval run --config evals/cli-copilot/agenteval.config.ts
agenteval run --config evals/api-openai/agenteval.config.ts
```

## Environment Variables

| Variable            | Required by                               |
| ------------------- | ----------------------------------------- |
| `ANTHROPIC_API_KEY` | `cli-aider`, `api-anthropic`, most judges |
| `OPENAI_API_KEY`    | `api-openai`, some judges                 |
| _(none)_            | `cli-mock` (offline)                      |
| _(none)_            | `api-ollama` (local Ollama)               |

## Judge Recommendations

> **⚠️ Always use a capable model as the judge.**

The judge reads git diffs, test output, build logs, and must make nuanced pass/fail decisions. Using a weak model leads to unreliable evaluations.

**Recommended judge models:**

| Provider  | Model                      | Notes                     |
| --------- | -------------------------- | ------------------------- |
| Anthropic | `claude-sonnet-4-20250514` | Best balance quality/cost |
| Anthropic | `claude-opus-4-20250514`   | Strongest reasoning       |
| OpenAI    | `gpt-4o`                   | Strong, fast              |

**Avoid for judging:** `gpt-3.5-turbo`, `claude-haiku`, local models (llama3, mistral) — they lack the reasoning depth for reliable code evaluation.

**Avoid self-evaluation:** When possible, use a different provider for the runner and the judge to prevent self-evaluation bias (e.g., Claude runner → GPT-4o judge).
