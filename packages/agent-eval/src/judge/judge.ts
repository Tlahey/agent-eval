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
 * Requires the `llm` plugin field.
 */
async function resolveModel(config: JudgeConfig): Promise<LanguageModelV1> {
  if (!config.llm) {
    throw new Error(
      'Judge requires an "llm" plugin in judge config.\n' +
        'Example: judge: { llm: new OpenAIModel({ model: "gpt-4o" }) }',
    );
  }
  return (await config.llm.createModel()) as LanguageModelV1;
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
export function buildJudgePrompt(opts: JudgePromptOptions): string {
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
 * Execute LLM-as-a-Judge evaluation.
 * Uses the configured IModelPlugin to call generateObject with structured output.
 */
export async function judge(
  _ctx: TestContext,
  prompt: string,
  config: JudgeConfig,
): Promise<JudgeResult> {
  const model = await resolveModel(config);

  const { object } = await generateObject({
    model,
    schema: JudgeResultSchema,
    prompt,
  });

  return object;
}
