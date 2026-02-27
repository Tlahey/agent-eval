# Judges

The **LLM-as-a-Judge** pattern uses a language model to evaluate agent outputs against criteria you define.

::: danger Use a capable model
The judge is the **most critical component** of your evaluation pipeline. It must understand code, parse git diffs, interpret test output, and make nuanced pass/fail decisions. **Always use a strong, frontier-class model** as the judge — never a small or local model.

**Recommended:** `claude-sonnet-4-20250514`, `claude-opus-4-20250514`, `gpt-4o`

**Avoid:** `gpt-3.5-turbo`, `claude-haiku`, local models (llama3, mistral, codellama) — they lack the reasoning depth for reliable code evaluation and will produce noisy, unreliable scores.
:::

::: tip Avoid self-evaluation bias
When possible, use a **different provider** for the runner and the judge. If your agent uses Claude, judge with GPT-4o (and vice versa). This prevents the model from being biased toward its own outputs.
:::

## How It Works

1. AgentEval builds a prompt with:
   - Your evaluation criteria
   - The captured git diff
   - All command outputs (test results, build logs)
2. The judge LLM returns a structured response:
   ```json
   { "pass": true, "score": 0.85, "reason": "..." }
   ```
3. Score ≥ 0.7 = pass, < 0.7 = fail

## Supported Providers

### Anthropic

```ts
judge: {
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
}
```

Requires `ANTHROPIC_API_KEY` environment variable (or `apiKey` in config).

| Model                      | Notes                        |
| -------------------------- | ---------------------------- |
| `claude-sonnet-4-20250514` | Recommended — best cost/perf |
| `claude-opus-4-20250514`   | Most capable, higher cost    |
| `claude-haiku-3-20250305`  | Fastest, cheapest            |

### OpenAI

```ts
judge: {
  provider: "openai",
  model: "gpt-4o",
}
```

Requires `OPENAI_API_KEY` environment variable (or `apiKey` in config).

| Model           | Notes           |
| --------------- | --------------- |
| `gpt-4o`        | Recommended     |
| `gpt-4-turbo`   | High capability |
| `gpt-3.5-turbo` | Budget option   |

### Ollama (Local)

```ts
judge: {
  provider: "ollama",
  model: "llama3",
  baseURL: "http://localhost:11434/v1", // default
}
```

No API key needed. Runs entirely on your machine.

| Model            | Notes                     |
| ---------------- | ------------------------- |
| `llama3`         | Meta's open model         |
| `mistral`        | Fast, general-purpose     |
| `deepseek-coder` | Strong on code evaluation |

::: info
Start Ollama before running: `ollama serve`. Pull models with `ollama pull llama3`.
:::

### Custom / Enterprise Provider

Any OpenAI-compatible API can be used as a judge via the `openai` provider with a custom `baseURL`:

```ts
judge: {
  provider: "openai",
  model: "company-judge-v2",
  baseURL: "https://llm.internal.company.com/v1",
  apiKey: process.env.INTERNAL_LLM_KEY,
}
```

This works with **Azure OpenAI**, **Together AI**, **Fireworks**, **Groq**, and any provider exposing an OpenAI-compatible chat completions API.

### CLI Judge

You can use **any CLI tool** as a judge — including `claude`, `gh copilot`, or a custom script. The CLI must output JSON with `{ pass, score, reason }`.

```ts
judge: {
  type: "cli",
  command: 'claude -p "Evaluate this code change: {{prompt}}" --output-format json',
}
```

::: tip Use `{{prompt_file}}` for long prompts
Git diffs can be thousands of lines. To avoid shell escaping issues, use `{{prompt_file}}` — AgentEval writes the full prompt to a temp file and replaces the placeholder with the file path:

```ts
judge: {
  type: "cli",
  command: "cat {{prompt_file}} | claude -p --output-format json",
}
```

:::

**Example — Claude CLI as judge:**

```ts
import { defineConfig } from "@anthropic-ai/agent-eval";

export default defineConfig({
  runner: {
    command: 'gh copilot suggest "{{prompt}}"',
  },
  judge: {
    type: "cli",
    command: 'claude -p "$(cat {{prompt_file}})" --output-format json',
  },
});
```

**The CLI must return valid JSON:**

```json
{ "pass": true, "score": 0.85, "reason": "The implementation is correct..." }
```

AgentEval extracts the first JSON object containing `pass`, `score`, and `reason` from stdout, so preamble text is ignored.

## Per-Test Model Override

You can override the judge model for specific evaluations:

```ts
await expect(ctx).toPassJudge({
  criteria: "...",
  model: "claude-opus-4-20250514", // More capable model for complex eval
});
```

This is useful when some tests need a stronger model for accurate evaluation while most can use a cheaper default.

## Scoring

| Score   | Meaning            |
| ------- | ------------------ |
| 1.0     | Perfect execution  |
| 0.7–0.9 | Good, minor issues |
| 0.4–0.6 | Partial success    |
| 0.1–0.3 | Major issues       |
| 0.0     | Complete failure   |

The judge is instructed to be "strict but fair" and award partial credit.

## Judge Prompt Anatomy

The system prompt sent to the judge includes:

1. **Role**: "You are an expert code reviewer acting as a judge"
2. **Criteria**: Your `criteria` string from `toPassJudge()`
3. **Git Diff**: The full diff captured by `ctx.storeDiff()`
4. **Command Outputs**: All `ctx.runCommand()` results (stdout, stderr, exit codes)

The response is enforced via Zod structured output (`generateObject`) for API judges, guaranteeing `{ pass, score, reason }` — no prompt injection or malformed JSON. For CLI judges, the JSON is parsed from stdout and validated against the same Zod schema.
