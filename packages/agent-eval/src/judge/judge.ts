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
  Thresholds,
} from "../core/types.js";
import { isCliModel } from "../core/interfaces.js";
import type { IModelPlugin, ICliModel } from "../core/interfaces.js";
import { computeStatus } from "../core/types.js";
import { getGlobalThresholds } from "../core/expect.js";

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
 */
async function resolveApiModel(llm: IModelPlugin): Promise<LanguageModelV1> {
  return (await llm.createModel()) as LanguageModelV1;
}

/**
 * Execute a CLI model as judge.
 */
async function executeCliJudge(
  cliModel: ICliModel,
  prompt: string,
  cwd: string,
  thresholds: Thresholds,
): Promise<{ result: JudgeResult; tokenUsage?: TokenUsage }> {
  const tmpDir = join(cwd, ".agenteval");
  mkdirSync(tmpDir, { recursive: true });
  const tmpFile = join(tmpDir, `.judge-prompt-${randomBytes(4).toString("hex")}.txt`);
  writeFileSync(tmpFile, prompt, "utf-8");

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
      cwd,
      timeout: 300_000,
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 10 * 1024 * 1024,
      shell: "/bin/sh",
    });
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    stdout = e.stdout ?? "";
    stderr = e.stderr ?? "";
    if (!stdout && stderr) {
      stdout = stderr;
    }
  } finally {
    try {
      unlinkSync(tmpFile);
    } catch {
      /* ignore */
    }
  }

  if (cliModel.parseOutput) {
    const metrics = cliModel.parseOutput({ stdout, stderr });
    if (metrics.agentOutput) stdout = metrics.agentOutput;
  }

  let parsed: any;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    const extracted = extractJsonFromText(stdout);
    if (extracted) parsed = JSON.parse(extracted);
    else parsed = parseTextAsJudgeResult(stdout);
  }

  if (!parsed || typeof parsed.score !== "number") {
    throw new Error(`CLI judge output is not valid JSON.`);
  }

  const score = parsed.score;
  const status = computeStatus(score, thresholds);

  return {
    result: {
      pass: status !== "FAIL",
      status,
      score,
      reason: parsed.reason || stdout,
      improvement: parsed.improvement || "",
    },
  };
}

/**
 * Extract changed file paths from a git diff string.
 */
export function extractChangedFiles(diff: string | null): string[] {
  if (!diff) return [];
  const matches = diff.matchAll(/^diff --git a\/(.+?) b\//gm);
  const files = [...matches].map((m) => m[1]);
  return files.filter((f) => !isInternalFile(f));
}

function isInternalFile(path: string): boolean {
  return (
    path.includes(".agenteval/") ||
    path.endsWith(".eval.ts") ||
    path.endsWith(".eval.js") ||
    path.endsWith("agenteval.config.ts") ||
    path.endsWith("agenteval.config.js") ||
    path.endsWith("agenteval.config.mjs") ||
    path === "package.json" ||
    path === "pnpm-lock.yaml" ||
    path === "yarn.lock" ||
    path === "package-lock.json"
  );
}

export function filterDiff(diff: string | null): string | null {
  if (!diff) return null;
  const blocks = diff.split(/^diff --git /gm);
  if (blocks.length <= 1) return diff;
  const header = blocks[0];
  const filteredBlocks = blocks.slice(1).filter((block) => {
    const match = block.match(/^a\/(.+?) b\//);
    if (!match) return true;
    return !isInternalFile(match[1]);
  });
  if (filteredBlocks.length === 0) return null;
  return header + filteredBlocks.map((b) => "diff --git " + b).join("");
}

export function extractJsonFromText(text: string): string | null {
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const jsonMatch = text.match(/\{[\s\S]*"score"\s*:[\s\S]*"reason"\s*:[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0];
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) return braceMatch[0];
  return null;
}

export function parseTextAsJudgeResult(text: string): any | null {
  const scoreMatch = text.match(/(?:score|rating|grade)\s*[:=]\s*(0(?:\.\d+)?|1(?:\.0+)?)/i);
  if (!scoreMatch) return null;
  const score = parseFloat(scoreMatch[1]);
  return {
    score,
    reason: text.trim(),
    improvement: "",
  };
}

export interface JudgePromptOptions {
  criteria: string;
  execution: ExecutionData;
  expectedFiles?: string[];
  requiredCommands?: string[];
}

export function buildJudgePrompt(opts: JudgePromptOptions): string {
  const { execution } = opts;
  const changedFiles = extractChangedFiles(execution.diff);
  const filteredDiff = filterDiff(execution.diff);

  const instructionSection = execution.instruction
    ? `\n## Agent Instruction\nThe agent was asked to: "${execution.instruction}"\n`
    : "";

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

  const fileScopeSection =
    opts.expectedFiles && opts.expectedFiles.length > 0
      ? `\n## File Scope Analysis\nExpected: ${opts.expectedFiles.join(", ")}\nActual: ${changedFiles.join(", ") || "(none)"}`
      : "";

  let commandSection = "";
  if (opts.requiredCommands && opts.requiredCommands.length > 0) {
    const history = execution.commands.map((c) => c.command);
    const analysis = opts.requiredCommands
      .map((req) => {
        const found = history.some((h) => h.includes(req));
        return `- \`${req}\`: ${found ? "✅ Executed" : "❌ MISSED"}`;
      })
      .join("\n");
    commandSection = `\n## Required Commands Analysis\n${analysis}\n`;
  }

  return `You are an expert code reviewer acting as a Judge.

## Evaluation Criteria
${opts.criteria}
${instructionSection}${taskSection}${commandSection}
## Code Changes
${filteredDiff || "(no changes captured)"}
${fileScopeSection}

## Scoring Instructions
- Score from 0.0 to 1.0.
- Provide JSON output only: { "pass": boolean, "score": number, "reason": "string", "improvement": "string" }`;
}

export interface JudgeCallResult {
  result: JudgeResult;
  tokenUsage?: TokenUsage;
}

/**
 * Execute judge evaluation.
 */
export async function judge(
  ctx: TestContext,
  prompt: string,
  config: JudgeConfig,
): Promise<JudgeCallResult> {
  if (!config.model) throw new Error('Judge requires a "model"');

  const thresholds = getGlobalThresholds();
  const maxRetries = config.maxRetries ?? 2;

  if (isCliModel(config.model)) {
    return executeCliJudge(config.model, prompt, ctx.cwd, thresholds);
  }

  const model = (await config.model.createModel()) as LanguageModelV1;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await generateObject({
        model,
        schema: JudgeResultSchema,
        prompt,
      });

      const score = response.object.score;
      const status = computeStatus(score, thresholds);

      return {
        result: {
          ...response.object,
          status,
          pass: status !== "FAIL",
        },
        tokenUsage: response.usage
          ? {
              inputTokens: response.usage.promptTokens,
              outputTokens: response.usage.completionTokens,
              totalTokens: response.usage.totalTokens,
            }
          : undefined,
      };
    } catch (err) {
      if (attempt === maxRetries) throw err;
    }
  }
  throw new Error("Judge failed");
}
