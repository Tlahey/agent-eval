import { execSync } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { generateObject, type LanguageModelV1 } from "ai";
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
 * Resolve the AI SDK model instance from judge config.
 * Prefers the new `llm` plugin, falls back to legacy `provider` + `model` fields.
 */
async function resolveModel(config: JudgeConfig, modelOverride?: string): Promise<LanguageModelV1> {
  // New plugin-based path
  if (config.llm) {
    return (await config.llm.createModel()) as LanguageModelV1;
  }

  // Legacy path — hardcoded provider resolution (deprecated)
  if (!config.provider || !config.model) {
    throw new Error(
      'Judge requires an "llm" plugin, or legacy "provider" and "model" fields in judge config.',
    );
  }

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
 * Options for building the unified judge prompt.
 * All fields except `criteria` and `ctx` are optional — the prompt adapts
 * dynamically based on what is available.
 */
export interface JudgePromptOptions {
  /** Evaluation criteria (from toPassJudge) */
  criteria: string;
  /** Test context (diff, logs, commands) */
  ctx: TestContext;
  /** Agent instruction (from instruct()) — included when available */
  instruction?: string;
  /** Task results with definitions — included when tasks were registered */
  taskResults?: Array<{ task: TaskDefinition; result: CommandResult }>;
  /** Expected files — triggers file scope analysis */
  expectedFiles?: string[];
}

/**
 * Build the single, unified judge prompt.
 * Adapts dynamically based on available context:
 * - Always: role, criteria, code changes, scoring instructions
 * - If instruction provided: agent instruction section
 * - If tasks provided: task results with weighted criteria
 * - If expectedFiles provided: file scope analysis
 */
export function buildJudgePrompt(opts: JudgePromptOptions): string;
/**
 * @deprecated Use the single-object overload instead.
 * Kept for backward compatibility with tests.
 */
export function buildJudgePrompt(
  criteria: string,
  ctx: TestContext,
  expectedFiles?: string[],
): string;
export function buildJudgePrompt(
  criteriaOrOpts: string | JudgePromptOptions,
  ctx?: TestContext,
  expectedFiles?: string[],
): string {
  // Normalize to JudgePromptOptions
  const opts: JudgePromptOptions =
    typeof criteriaOrOpts === "string"
      ? { criteria: criteriaOrOpts, ctx: ctx!, expectedFiles }
      : criteriaOrOpts;

  const changedFiles = extractChangedFiles(opts.ctx.diff);
  const fileScopeSection = buildFileScopeSection(changedFiles, opts.expectedFiles);

  // Build instruction section (only in declarative mode)
  const instructionSection = opts.instruction
    ? `\n## Agent Instruction\nThe agent was asked to: "${opts.instruction}"\n`
    : "";

  // Build task results section (only when tasks are registered)
  let taskSection = "";
  if (opts.taskResults && opts.taskResults.length > 0) {
    const totalWeight = opts.taskResults.reduce((sum, tr) => sum + (tr.task.weight ?? 1), 0);
    const taskBlocks = opts.taskResults
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

    taskSection = `\n## Task Results (${opts.taskResults.length} tasks, total weight: ${totalWeight})
${taskBlocks}\n`;
  }

  // Build scoring instructions — adapt to task presence
  const taskScoringInstructions =
    opts.taskResults && opts.taskResults.length > 0
      ? `- For each task, assess whether its criteria were met. Weight the scores accordingly.
- A task with exit code 0 and output matching its criteria should score positively.
- A task with non-zero exit code should score negatively unless the criteria explicitly allow it.`
      : "";

  return `You are an expert code reviewer acting as a Judge for an AI coding agent evaluation.

## Evaluation Criteria
${opts.criteria}
${instructionSection}${taskSection}
## Code Changes
${opts.ctx.logs || "(no logs captured)"}
${fileScopeSection}

## Scoring Instructions
- Evaluate whether the agent's code changes correctly fulfill the criteria.
${taskScoringInstructions}
- Score from 0.0 (complete failure) to 1.0 (perfect execution).
- Set pass=true if the overall score is satisfactory.
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
async function judgeCli(prompt: string, config: JudgeConfig): Promise<JudgeResult> {
  if (!config.command) {
    throw new Error('CLI judge requires a "command" field in judge config.');
  }

  const maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;

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
 * Execute LLM-as-a-Judge evaluation (API or CLI).
 * Accepts a pre-built prompt string (from buildJudgePrompt).
 */
export async function judge(
  ctx: TestContext,
  prompt: string,
  config: JudgeConfig,
  modelOverride?: string,
): Promise<JudgeResult> {
  // CLI judge path
  if (config.type === "cli") {
    return judgeCli(prompt, config);
  }

  // API judge path (default)
  if (!config.llm && (!config.provider || !config.model)) {
    throw new Error(
      'API judge requires an "llm" plugin, or legacy "provider" and "model" fields in judge config.',
    );
  }

  const model = await resolveModel(config, modelOverride);

  const { object } = await generateObject({
    model,
    schema: JudgeResultSchema,
    prompt,
  });

  return object;
}
