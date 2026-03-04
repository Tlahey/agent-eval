import { generateObject, type LanguageModelV1 } from "ai";
import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import type {
  ExecutionData,
  JudgeConfig,
  JudgeResult,
  TestContext,
  TokenUsage,
} from "../core/types.js";
import { isCliModel } from "../core/interfaces.js";
import type { IModelPlugin, ICliModel } from "../core/interfaces.js";
import { debug } from "../core/debug.js";

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
 * Requires the `llm` plugin field and must be an IModelPlugin (not CLI).
 */
async function resolveApiModel(llm: IModelPlugin): Promise<LanguageModelV1> {
  return (await llm.createModel()) as LanguageModelV1;
}

/**
 * Execute a CLI model as judge: run the command with the prompt, parse JSON output.
 * The CLI command must output valid JSON: { pass, score, reason, improvement }.
 */
async function executeCliJudge(
  cliModel: ICliModel,
  prompt: string,
): Promise<{ result: JudgeResult; tokenUsage?: TokenUsage }> {
  // Write prompt to a temp file to avoid shell escaping issues with large prompts
  const tmpDir = join(process.cwd(), ".agenteval");
  mkdirSync(tmpDir, { recursive: true });
  const tmpFile = join(tmpDir, `.judge-prompt-${randomBytes(4).toString("hex")}.txt`);
  writeFileSync(tmpFile, prompt, "utf-8");

  // Replace {{prompt}} with the file-based approach
  // If the command uses {{prompt}}, replace with $(cat tmpFile) for shell substitution
  // If the command uses {{promptFile}}, replace with the file path directly
  let cmd: string;
  if (cliModel.command.includes("{{promptFile}}")) {
    cmd = cliModel.command.replace("{{promptFile}}", tmpFile);
  } else {
    const escapedPath = tmpFile.replace(/'/g, "'\\''");
    cmd = cliModel.command.replace("{{prompt}}", `$(cat '${escapedPath}')`);
  }

  let stdout: string;
  let stderr = "";
  try {
    stdout = execSync(cmd, {
      encoding: "utf-8",
      timeout: 300_000,
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 10 * 1024 * 1024,
      shell: "/bin/sh",
    });
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    stdout = e.stdout ?? "";
    stderr = e.stderr ?? "";
    if (!stdout && !stderr) {
      throw new Error(
        `CLI judge command failed (exit ${e.status ?? 1}): no output captured.\nCommand: ${cmd.slice(0, 300)}`,
        { cause: err },
      );
    }
    // If stdout is empty but stderr has content, try stderr as the output
    if (!stdout && stderr) {
      console.warn(
        `⚠️ CLI judge stdout was empty, falling back to stderr (${stderr.length} chars)`,
      );
      stdout = stderr;
    }
  } finally {
    // Clean up temp file
    try {
      unlinkSync(tmpFile);
    } catch {
      // ignore cleanup errors
    }
  }

  // Debug: log raw output lengths
  debug(`CLI judge raw output: stdout=${stdout.length} chars, stderr=${stderr.length} chars`);

  // If the CLI model has a parseOutput function, use it
  if (cliModel.parseOutput) {
    const metrics = cliModel.parseOutput({ stdout, stderr });
    if (metrics.agentOutput) stdout = metrics.agentOutput;
  }

  // Parse the JSON output — try direct parse first, then extract from text
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    // LLMs often wrap JSON in natural language or markdown fences — try to extract it
    const extracted = extractJsonFromText(stdout);
    if (extracted) {
      debug(`Extracted JSON block (${extracted.length} chars) from text output`);
      try {
        parsed = JSON.parse(extracted);
      } catch {
        // Fall through to error
      }
    }
    if (!parsed) {
      // Show both stdout and stderr in error for debugging
      const preview = stdout.slice(0, 800) || "(empty)";
      const stderrPreview = stderr ? `\nStderr: ${stderr.slice(0, 400)}` : "";
      throw new Error(
        `CLI judge output is not valid JSON.\nCommand: ${cmd.slice(0, 200)}\nOutput (${stdout.length} chars): ${preview}${stderrPreview}`,
      );
    }
  }

  const obj = parsed as Record<string, unknown>;
  if (typeof obj.score !== "number" || typeof obj.reason !== "string") {
    throw new Error(
      `CLI judge JSON missing required fields (score, reason).\nGot: ${JSON.stringify(obj).slice(0, 500)}`,
    );
  }

  return {
    result: {
      pass: typeof obj.pass === "boolean" ? obj.pass : obj.score >= 0.5,
      score: obj.score,
      reason: obj.reason,
      improvement: typeof obj.improvement === "string" ? obj.improvement : "",
    },
  };
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
 * Try to extract a JSON object from mixed text output.
 * Handles common LLM patterns: ```json fences, inline JSON objects.
 */
export function extractJsonFromText(text: string): string | null {
  // 1. Try ```json ... ``` fenced blocks
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) return fenceMatch[1].trim();

  // 2. Try to find a top-level JSON object with expected fields
  const jsonMatch = text.match(/\{[\s\S]*"score"\s*:[\s\S]*"reason"\s*:[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0];

  // 3. Generic: find the largest {...} block
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) return braceMatch[0];

  return null;
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
 * Uses ExecutionData as the single source of truth for all execution context.
 */
export interface JudgePromptOptions {
  /** Evaluation criteria (from toPassJudge) */
  criteria: string;
  /** Unified execution data (diff, commands, tasks, timing, tokens, etc.) */
  execution: ExecutionData;
  /** Expected files — triggers file scope analysis */
  expectedFiles?: string[];
}

/**
 * Build the single, unified judge prompt.
 * Adapts dynamically based on available context in ExecutionData:
 * - Always: role, criteria, code changes, scoring instructions
 * - If instruction provided: agent instruction section
 * - If tasks provided: task results with weighted criteria
 * - If expectedFiles provided: file scope analysis
 */
export function buildJudgePrompt(opts: JudgePromptOptions): string;
export function buildJudgePrompt(opts: JudgePromptOptions): string {
  const { execution } = opts;
  const fileScopeSection = buildFileScopeSection(execution.changedFiles, opts.expectedFiles);

  // Build instruction section (only in declarative mode)
  const instructionSection = execution.instruction
    ? `\n## Agent Instruction\nThe agent was asked to: "${execution.instruction}"\n`
    : "";

  // Build task results section (only when tasks are registered)
  let taskSection = "";
  if (execution.taskResults.length > 0) {
    const totalWeight = execution.taskResults.reduce((sum, tr) => sum + (tr.task.weight ?? 1), 0);
    const taskBlocks = execution.taskResults
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

    taskSection = `\n## Task Results (${execution.taskResults.length} tasks, total weight: ${totalWeight})
${taskBlocks}\n`;
  }

  // Build scoring instructions — adapt to task presence
  const taskScoringInstructions =
    execution.taskResults.length > 0
      ? `- For each task, assess whether its criteria were met. Weight the scores accordingly.
- A task with exit code 0 and output matching its criteria should score positively.
- A task with non-zero exit code should score negatively unless the criteria explicitly allow it.`
      : "";

  return `You are an expert code reviewer acting as a Judge for an AI coding agent evaluation.

## Evaluation Criteria
${opts.criteria}
${instructionSection}${taskSection}
## Code Changes
${execution.logs || "(no logs captured)"}
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

/** Result from judge() including token usage */
export interface JudgeCallResult {
  result: JudgeResult;
  tokenUsage?: TokenUsage;
}

const DEFAULT_MAX_RETRIES = 2;

/**
 * Execute LLM-as-a-Judge evaluation with retry logic.
 * Supports both API models (generateObject) and CLI models (shell exec + JSON parse).
 * Retries on invalid/unparseable responses to guarantee valid structured output.
 * Returns both the judge result and token usage.
 */
export async function judge(
  _ctx: TestContext,
  prompt: string,
  config: JudgeConfig,
): Promise<JudgeCallResult> {
  if (!config.model) {
    throw new Error(
      'Judge requires a "model" in judge config.\n' +
        'Example: judge: { name: "gpt-4o", model: new OpenAIModel({ model: "gpt-4o" }) }',
    );
  }

  const maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
  let lastError: Error | null = null;

  // CLI model path: execute shell command, parse JSON output
  if (isCliModel(config.model)) {
    const cliModel = config.model;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await executeCliJudge(cliModel, prompt);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < maxRetries) {
          console.warn(
            `\n⚠️ CLI Judge attempt ${attempt + 1}/${maxRetries + 1} failed, retrying...\n   ${lastError.message.slice(0, 300)}\n`,
          );
        }
      }
    }
    throw new Error(
      `CLI Judge failed after ${maxRetries + 1} attempts. Last error: ${lastError!.message}`,
    );
  }

  // API model path: use generateObject with Zod schema
  const model = await resolveApiModel(config.model);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await generateObject({
        model,
        schema: JudgeResultSchema,
        prompt,
      });

      const tokenUsage: TokenUsage | undefined = response.usage
        ? {
            inputTokens: response.usage.promptTokens,
            outputTokens: response.usage.completionTokens,
            totalTokens: response.usage.totalTokens,
          }
        : undefined;

      return { result: response.object, tokenUsage };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < maxRetries) {
        console.warn(
          `⚠️ Judge attempt ${attempt + 1}/${maxRetries + 1} failed, retrying... (${lastError.message.slice(0, 100)})`,
        );
      }
    }
  }

  throw new Error(
    `Judge failed after ${maxRetries + 1} attempts. Last error: ${lastError!.message}`,
  );
}
