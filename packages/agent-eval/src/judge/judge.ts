import { execSync } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { generateObject } from "ai";
import { z } from "zod";
import type { JudgeConfig, JudgeResult, TestContext } from "../core/types.js";

const JudgeResultSchema = z.object({
  pass: z.boolean().describe("Whether the agent output meets the criteria"),
  score: z.number().min(0).max(1).describe("Score from 0.0 (total failure) to 1.0 (perfect)"),
  reason: z.string().describe("Markdown-formatted explanation of the evaluation"),
});

/**
 * Resolve the AI SDK model instance from provider + model name.
 */
async function resolveModel(config: JudgeConfig, modelOverride?: string) {
  const modelName = modelOverride ?? config.model!;

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
export function buildJudgePrompt(criteria: string, ctx: TestContext): string {
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
- Be strict but fair. Partial credit is encouraged.
- Respond ONLY with valid JSON: { "pass": boolean, "score": number, "reason": string }`;
}

/**
 * Execute a CLI-based judge.
 * Writes the prompt to a temp file, passes it to the command via {{prompt}},
 * and parses the JSON output from stdout.
 */
async function judgeCli(
  ctx: TestContext,
  criteria: string,
  config: JudgeConfig,
): Promise<JudgeResult> {
  if (!config.command) {
    throw new Error('CLI judge requires a "command" field in judge config.');
  }

  const prompt = buildJudgePrompt(criteria, ctx);

  // Write prompt to a temp file to avoid shell escaping issues
  const tmpDir = mkdtempSync(join(tmpdir(), "agenteval-judge-"));
  const promptFile = join(tmpDir, "prompt.txt");
  writeFileSync(promptFile, prompt, "utf-8");

  try {
    const cmd = config.command
      .replace("{{prompt}}", prompt.replace(/"/g, '\\"'))
      .replace("{{prompt_file}}", promptFile);

    const stdout = execSync(cmd, {
      encoding: "utf-8",
      timeout: 300_000,
    });

    // Parse JSON from stdout (may contain non-JSON preamble)
    const jsonMatch = stdout.match(/\{[\s\S]*"pass"[\s\S]*"score"[\s\S]*"reason"[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(
        `CLI judge did not return valid JSON with { pass, score, reason }.\nOutput: ${stdout.slice(0, 500)}`,
      );
    }

    const parsed = JudgeResultSchema.parse(JSON.parse(jsonMatch[0]));
    return parsed;
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Execute LLM-as-a-Judge evaluation (API or CLI).
 */
export async function judge(
  ctx: TestContext,
  criteria: string,
  config: JudgeConfig,
  modelOverride?: string,
): Promise<JudgeResult> {
  // CLI judge path
  if (config.type === "cli") {
    return judgeCli(ctx, criteria, config);
  }

  // API judge path (default)
  if (!config.provider || !config.model) {
    throw new Error('API judge requires "provider" and "model" fields in judge config.');
  }

  const model = await resolveModel(config, modelOverride);

  const { object } = await generateObject({
    model,
    schema: JudgeResultSchema,
    prompt: buildJudgePrompt(criteria, ctx),
  });

  return object;
}
