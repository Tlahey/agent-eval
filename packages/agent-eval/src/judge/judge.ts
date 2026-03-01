import { execSync } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { generateObject } from "ai";
import { z } from "zod";
import type {
  CommandResult,
  JudgeConfig,
  JudgeResult,
  TaskDefinition,
  TestContext,
} from "../core/types.js";

const JudgeResultSchema = z.object({
  pass: z.boolean().describe("Whether the agent output meets the criteria"),
  score: z.number().min(0).max(1).describe("Score from 0.0 (total failure) to 1.0 (perfect)"),
  reason: z.string().describe("Markdown-formatted explanation of the evaluation"),
  improvement: z
    .string()
    .describe("Markdown-formatted actionable suggestions to improve the score"),
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
 * Extract changed file paths from a git diff string.
 */
export function extractChangedFiles(diff: string | null): string[] {
  if (!diff) return [];
  const matches = diff.matchAll(/^diff --git a\/(.+?) b\//gm);
  return [...matches].map((m) => m[1]);
}

/**
 * Build the file scope analysis section for the judge prompt.
 */
function buildFileScopeSection(changedFiles: string[], expectedFiles?: string[]): string {
  if (!expectedFiles || expectedFiles.length === 0) return "";

  const expected = new Set(expectedFiles);
  const missing = expectedFiles.filter((f) => !changedFiles.includes(f));
  const unexpected = changedFiles.filter((f) => !expected.has(f));

  const parts: string[] = ["\n## File Scope Analysis"];
  parts.push(`\n**Expected files:** ${expectedFiles.join(", ")}`);
  parts.push(
    `**Actually changed:** ${changedFiles.length > 0 ? changedFiles.join(", ") : "(none)"}`,
  );

  if (missing.length > 0) {
    parts.push(`\n⚠️ **Missing expected files:** ${missing.join(", ")}`);
  }
  if (unexpected.length > 0) {
    parts.push(`\n⚠️ **Unexpected file changes:** ${unexpected.join(", ")}`);
  }

  parts.push(
    "\n**Instructions for file scope:**",
    "- All expected files MUST be modified. Missing expected files should significantly reduce the score.",
    "- Unexpected file changes are acceptable ONLY if they are directly necessary for the task (e.g., updating imports, adding new test files).",
    "- If many unexpected files are changed, this may indicate scope creep — lower the score and explain why.",
  );

  return parts.join("\n");
}

/**
 * Build the system prompt for the judge LLM.
 */
export function buildJudgePrompt(
  criteria: string,
  ctx: TestContext,
  expectedFiles?: string[],
): string {
  const changedFiles = extractChangedFiles(ctx.diff);
  const fileScopeSection = buildFileScopeSection(changedFiles, expectedFiles);

  return `You are an expert code reviewer acting as a Judge for an AI coding agent evaluation.

Your task: evaluate whether the agent's output meets the given criteria.

## Evaluation Criteria
${criteria}

## Agent Output Context
${ctx.logs || "(no logs captured)"}
${fileScopeSection}

## Instructions
- Analyze the git diff and command outputs above.
- Score from 0.0 (complete failure) to 1.0 (perfect execution).
- Set pass=true if score >= 0.7.
- Provide a detailed Markdown explanation in "reason".
- Provide actionable Markdown suggestions in "improvement" to help the agent achieve a higher score. If the score is 1.0, write "No improvement needed.".
- Be strict but fair. Partial credit is encouraged.
- Respond ONLY with valid JSON: { "pass": boolean, "score": number, "reason": string, "improvement": string }`;
}

/**
 * Extract and validate a JudgeResult JSON from raw CLI output.
 * Handles preamble text, markdown code fences, and nested JSON.
 */
export function extractJudgeJson(stdout: string): JudgeResult {
  // Strip markdown code fences if present
  const stripped = stdout.replace(/```(?:json)?\s*/g, "").replace(/```\s*/g, "");

  // Try to find a JSON object containing our required fields
  const jsonMatch = stripped.match(
    /\{[\s\S]*?"pass"\s*:[\s\S]*?"score"\s*:[\s\S]*?"reason"\s*:[\s\S]*?"improvement"\s*:[\s\S]*?\}/,
  );
  if (!jsonMatch) {
    throw new Error(
      `CLI judge output does not contain valid JSON with { pass, score, reason, improvement }.\nOutput: ${stdout.slice(0, 500)}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error(
      `CLI judge output contains malformed JSON.\nExtracted: ${jsonMatch[0].slice(0, 300)}`,
    );
  }

  // Validate with Zod — throws ZodError with detailed field info on failure
  return JudgeResultSchema.parse(parsed);
}

const DEFAULT_MAX_RETRIES = 2;

/**
 * Execute a CLI-based judge with retry logic.
 * Writes the prompt to a temp file, passes it to the command,
 * parses the JSON output, and retries on validation failure.
 */
async function judgeCli(
  ctx: TestContext,
  criteria: string,
  config: JudgeConfig,
  expectedFiles?: string[],
): Promise<JudgeResult> {
  if (!config.command) {
    throw new Error('CLI judge requires a "command" field in judge config.');
  }

  const maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
  const prompt = buildJudgePrompt(criteria, ctx, expectedFiles);

  // Write prompt to a temp file to avoid shell escaping issues
  const tmpDir = mkdtempSync(join(tmpdir(), "agenteval-judge-"));
  const promptFile = join(tmpDir, "prompt.txt");
  writeFileSync(promptFile, prompt, "utf-8");

  try {
    const cmd = config.command
      .replace("{{prompt}}", prompt.replace(/"/g, '\\"'))
      .replace("{{prompt_file}}", promptFile);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const stdout = execSync(cmd, {
          encoding: "utf-8",
          timeout: 300_000,
        });

        return extractJudgeJson(stdout);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        // Only retry on JSON parsing/validation errors, not on command failures
        const isValidationError =
          lastError.message.includes("does not contain valid JSON") ||
          lastError.message.includes("malformed JSON") ||
          lastError.name === "ZodError";

        if (!isValidationError || attempt >= maxRetries) {
          break;
        }

        // Log retry for visibility
        console.warn(
          `⚠️ CLI judge attempt ${attempt + 1}/${maxRetries + 1} failed (invalid JSON), retrying...`,
        );
      }
    }

    throw lastError!;
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Build the judge prompt for declarative pipeline mode.
 * Incorporates the agent instruction, task results with weighted criteria, and context.
 */
export function buildDeclarativeJudgePrompt(
  criteria: string,
  instruction: string,
  taskResults: Array<{ task: TaskDefinition; result: CommandResult }>,
  ctx: TestContext,
  expectedFiles?: string[],
): string {
  const changedFiles = extractChangedFiles(ctx.diff);
  const fileScopeSection = buildFileScopeSection(changedFiles, expectedFiles);

  const taskSections = taskResults
    .map((tr, i) => {
      const weight = tr.task.weight ?? 1;
      return `### Task ${i + 1}: ${tr.task.name} (weight: ${weight})
**Criteria:** ${tr.task.criteria}
**Exit code:** ${tr.result.exitCode}
**Output:**
\`\`\`
${tr.result.stdout.slice(0, 2000)}${tr.result.stderr ? `\nSTDERR:\n${tr.result.stderr.slice(0, 500)}` : ""}
\`\`\``;
    })
    .join("\n\n");

  const totalWeight = taskResults.reduce((sum, tr) => sum + (tr.task.weight ?? 1), 0);

  return `You are an expert code reviewer acting as a Judge for an AI coding agent evaluation.

## Evaluation Criteria
${criteria}

## Agent Instruction
The agent was asked to: "${instruction}"

## Task Results (${taskResults.length} tasks, total weight: ${totalWeight})
${taskSections || "(no tasks registered)"}

## Code Changes
${ctx.logs || "(no logs captured)"}
${fileScopeSection}

## Scoring Instructions
- Evaluate whether the agent's code changes correctly fulfill the instruction.
- For each task, assess whether its criteria were met. Weight the scores accordingly.
- Score from 0.0 (complete failure) to 1.0 (perfect execution).
- Set pass=true if the overall score is satisfactory.
- A task with exit code 0 and output matching its criteria should score positively.
- A task with non-zero exit code should score negatively unless the criteria explicitly allow it.
- Provide a detailed Markdown explanation in "reason".
- Provide actionable Markdown suggestions in "improvement".
- Be strict but fair. Partial credit is encouraged.
- Respond ONLY with valid JSON: { "pass": boolean, "score": number, "reason": string, "improvement": string }`;
}

/**
 * Execute LLM-as-a-Judge evaluation (API or CLI).
 */
export async function judge(
  ctx: TestContext,
  criteria: string,
  config: JudgeConfig,
  modelOverride?: string,
  expectedFiles?: string[],
): Promise<JudgeResult> {
  // CLI judge path
  if (config.type === "cli") {
    return judgeCli(ctx, criteria, config, expectedFiles);
  }

  // API judge path (default)
  if (!config.provider || !config.model) {
    throw new Error('API judge requires "provider" and "model" fields in judge config.');
  }

  const model = await resolveModel(config, modelOverride);

  const { object } = await generateObject({
    model,
    schema: JudgeResultSchema,
    prompt: buildJudgePrompt(criteria, ctx, expectedFiles),
  });

  return object;
}
