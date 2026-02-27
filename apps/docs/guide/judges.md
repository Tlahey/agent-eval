# Judges

The **LLM-as-a-Judge** pattern uses a language model to evaluate agent outputs against criteria you define.

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

### OpenAI

```ts
judge: {
  provider: "openai",
  model: "gpt-4o",
}
```

Requires `OPENAI_API_KEY` environment variable (or `apiKey` in config).

### Ollama (Local)

```ts
judge: {
  provider: "ollama",
  model: "llama3",
  baseURL: "http://localhost:11434/v1", // default
}
```

No API key needed. Runs locally.

## Per-Test Model Override

You can override the judge model for specific evaluations:

```ts
await expect(ctx).toPassJudge({
  criteria: "...",
  model: "claude-opus-4-20250514", // More capable model for complex eval
});
```

## Scoring

| Score | Meaning |
|-------|---------|
| 1.0 | Perfect execution |
| 0.7–0.9 | Good, minor issues |
| 0.4–0.6 | Partial success |
| 0.1–0.3 | Major issues |
| 0.0 | Complete failure |

The judge is instructed to be "strict but fair" and award partial credit.
