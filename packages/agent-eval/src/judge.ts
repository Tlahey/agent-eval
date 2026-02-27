import { generateObject } from "ai";
import { z } from "zod";
import type { JudgeConfig, JudgeResult, TestContext } from "./types.js";

const JudgeResultSchema = z.object({
  pass: z.boolean().describe("Whether the agent output meets the criteria"),
  score: z
    .number()
    .min(0)
    .max(1)
    .describe("Score from 0.0 (total failure) to 1.0 (perfect)"),
  reason: z
    .string()
    .describe("Markdown-formatted explanation of the evaluation"),
});

/**
 * Resolve the AI SDK model instance from provider + model name.
 */
async function resolveModel(config: JudgeConfig, modelOverride?: string) {
  const modelName = modelOverride ?? config.model;

  switch (config.provider) {
    case "anthropic": {
      const { createAnthropic } = await import("@ai-sdk/anthropic");
      const provider = createAnthropic({
        apiKey: config.apiKey ?? process.env.ANTHROPIC_API_KEY,
        ...(config.baseURL ? { baseURL: config.baseURL } : {}),
      });
      return provider(modelName);
    }
    case "openai": {
      const { createOpenAI } = await import("@ai-sdk/openai");
      const provider = createOpenAI({
        apiKey: config.apiKey ?? process.env.OPENAI_API_KEY,
        ...(config.baseURL ? { baseURL: config.baseURL } : {}),
      });
      return provider(modelName);
    }
    case "ollama": {
      const { createOpenAI } = await import("@ai-sdk/openai");
      const provider = createOpenAI({
        baseURL: config.baseURL ?? "http://localhost:11434/v1",
        apiKey: "ollama",
      });
      return provider(modelName);
    }
    default:
      throw new Error(`Unsupported judge provider: ${config.provider}`);
  }
}

/**
 * Build the system prompt for the judge LLM.
 */
function buildJudgePrompt(criteria: string, ctx: TestContext): string {
  return `You are an expert code reviewer acting as a Judge for an AI coding agent evaluation.

Your task: evaluate whether the agent's output meets the given criteria.

## Evaluation Criteria
${criteria}

## Agent Output Context
${ctx.logs || "(no logs captured)"}

## Instructions
- Analyze the git diff and command outputs above.
- Score from 0.0 (complete failure) to 1.0 (perfect execution).
- Set pass=true if score >= 0.7.
- Provide a detailed Markdown explanation in "reason".
- Be strict but fair. Partial credit is encouraged.`;
}

/**
 * Execute LLM-as-a-Judge evaluation.
 */
export async function judge(
  ctx: TestContext,
  criteria: string,
  config: JudgeConfig,
  modelOverride?: string
): Promise<JudgeResult> {
  const model = await resolveModel(config, modelOverride);

  const { object } = await generateObject({
    model,
    schema: JudgeResultSchema,
    prompt: buildJudgePrompt(criteria, ctx),
  });

  return object;
}
