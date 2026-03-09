import { EvalContext } from "./context.js";
import { appendLedgerEntry } from "../ledger/ledger.js";
import { judge as runJudge, buildJudgePrompt } from "../judge/judge.js";
import { getMatchingHooks, getRegisteredBeforeEachHooks } from "../index.js";
import type {
  AgentEvalConfig,
  AgentHandle,
  CommandResult,
  JudgeOptions,
  LedgerEntry,
  LlmConfig,
  RunnerConfig,
  TaskResult,
  TestDefinition,
  TimingData,
  TestVariant,
} from "./types.js";
import { computeStatus, DEFAULT_THRESHOLDS } from "./types.js";
import type { ILedgerPlugin, IEnvironmentPlugin, RunnerExecResult } from "./interfaces.js";
import { isCliModel } from "./interfaces.js";
import { validateRunnerNames } from "./config.js";
import { LocalEnvironment } from "../environment/plugins/local.js";
import type { Reporter } from "./reporter.js";
import { SilentReporter } from "./reporter.js";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

/** Get the model identifier from an LlmConfig (IModelPlugin or ICliModel). */
function resolveModelId(llm: LlmConfig | undefined): string {
  if (!llm) return "unknown";
  return isCliModel(llm) ? llm.name : (llm.modelId ?? "unknown");
}

/**
 * Execute a runner config against a prompt.
 */
async function executeRunner(
  runner: RunnerConfig,
  prompt: string,
  cwd: string,
  env: IEnvironmentPlugin,
  timeout?: number,
  onOutput?: (data: string) => void,
): Promise<RunnerExecResult> {
  if (isCliModel(runner.model)) {
    const cmd = runner.model.command.replace("{{prompt}}", prompt);
    const result = await env.execute(cmd, cwd, {
      timeout: timeout ?? 600_000,
      onStdout: onOutput,
      onStderr: onOutput,
    });

    if (runner.model.parseOutput) {
      const metrics = runner.model.parseOutput({
        stdout: result.stdout,
        stderr: result.stderr,
      });
      return {
        stdout: metrics.agentOutput ?? result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        tokenUsage: metrics.tokenUsage,
        output: metrics.agentOutput,
      };
    }

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
    };
  } else {
    const { maxSteps: _maxSteps, ...modelSettings } = runner.model.settings ?? {};
    const model = await runner.model.createModel();

    if (runner.model.tools && Object.keys(runner.model.tools).length > 0) {
      const { generateText } = await import("ai");
      const { text, usage } = await generateText({
        model: model as Parameters<typeof generateText>[0]["model"],
        tools: runner.model.tools as Parameters<typeof generateText>[0]["tools"],
        maxSteps: _maxSteps ?? 10,
        prompt,
        ...modelSettings,
      });
      const tokenUsage = usage
        ? {
            inputTokens: usage.promptTokens,
            outputTokens: usage.completionTokens,
            totalTokens: usage.totalTokens,
          }
        : undefined;
      return { tokenUsage, output: text };
    }

    const { generateObject } = await import("ai");
    const { z } = await import("zod");
    const FileOperationSchema = z.object({
      files: z.array(
        z.object({
          path: z.string().describe("Relative file path from project root"),
          content: z.string().describe("Full file content to write"),
        }),
      ),
    });

    const { object, usage } = await generateObject({
      model: model as Parameters<typeof generateObject>[0]["model"],
      schema: FileOperationSchema,
      prompt: `You are an expert coding agent. Task: ${prompt}`,
      ...modelSettings,
    });

    const response = object as { files: Array<{ path: string; content: string }> };
    const filesWritten: string[] = [];
    for (const file of response.files) {
      const fullPath = resolve(cwd, file.path);
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, file.content, "utf-8");
      filesWritten.push(file.path);
    }
    const tokenUsage = usage
      ? {
          inputTokens: usage.promptTokens,
          outputTokens: usage.completionTokens,
          totalTokens: usage.totalTokens,
        }
      : undefined;
    return { filesWritten, tokenUsage };
  }
}

/** Get the model display string for a runner */
function getRunnerModelId(runner: RunnerConfig): string {
  if (isCliModel(runner.model)) return runner.model.command;
  return runner.model.modelId;
}

/**
 * Execute the agent for a context.
 */
async function executeAgent(
  runner: RunnerConfig,
  prompt: string,
  cwd: string,
  env: IEnvironmentPlugin,
  ctx: EvalContext,
  reporter: Reporter,
  testId: string,
): Promise<void> {
  const onOutput = reporter.onPipelineOutput
    ? (data: string) => reporter.onPipelineOutput!({ testId, runner: runner.id }, "agent", data)
    : undefined;

  const result = await executeRunner(runner, prompt, cwd, env, undefined, onOutput);

  if (result.stdout) ctx.setAgentOutput(result.stdout);
  else if (result.output) ctx.setAgentOutput(result.output);

  if (result.tokenUsage) ctx.setAgentTokenUsage(result.tokenUsage);

  if (result.exitCode !== undefined && result.exitCode !== 0 && result.stderr) {
    reporter.onTestError({ testId, runner: runner.id }, result.stderr.slice(0, 500));
  }

  if (result.filesWritten) {
    for (const filePath of result.filesWritten) {
      reporter.onFileWrite({ testId, runner: runner.id }, filePath);
    }
  }
}

export interface RunResult {
  testId: string;
  runner: string;
  entries: LedgerEntry[];
  passed: boolean;
}

/**
 * Run a single test definition.
 */
export async function runTest(
  testDef: TestDefinition,
  config: AgentEvalConfig,
  reporter?: Reporter,
): Promise<RunResult[]> {
  const rep = reporter ?? new SilentReporter();
  const cwd = config.rootDir ?? process.cwd();
  const outputDir = config.outputDir ?? ".agenteval";
  const ledger: ILedgerPlugin | null = config.ledger ?? null;
  const env: IEnvironmentPlugin = config.environment ?? new LocalEnvironment();
  validateRunnerNames(config.runners);

  const record = (entry: LedgerEntry): void | Promise<void> => {
    if (ledger) return ledger.recordRun(entry);
    appendLedgerEntry(outputDir, entry);
  };

  const runSingle = async (variant: TestVariant) => {
    const runner = config.runners.find((r) => r.id === variant.runner);
    if (!runner)
      throw new Error(`Runner "${variant.runner}" not found for variant "${variant.name}"`);
    const entry = await runSingleIteration(testDef, runner, config, rep, env, cwd, variant);
    await record(entry);
    return { testId: testDef.title, runner: runner.id, entries: [entry], passed: entry.pass };
  };

  if (env.supportsConcurrency) {
    return Promise.all(testDef.variants.map(runSingle));
  } else {
    const results: RunResult[] = [];
    for (const variant of testDef.variants) {
      results.push(await runSingle(variant));
    }
    return results;
  }
}

async function runSingleIteration(
  testDef: TestDefinition,
  runner: RunnerConfig,
  config: AgentEvalConfig,
  rep: Reporter,
  env: IEnvironmentPlugin,
  cwd: string,
  variant: TestVariant,
): Promise<LedgerEntry> {
  clearLastJudgeOptions();

  const event = {
    testId: testDef.title,
    runner: runner.id,
    suitePath: testDef.suitePath,
    variantName: variant.name,
  };
  rep.onTestStart(event);

  const setupStart = Date.now();
  rep.onPipelineStep(event, "setup", "running");

  let workingDir = cwd;
  let cleanupRun: (() => Promise<void>) | undefined;

  if (env.prepareRun) {
    const prepared = await env.prepareRun(cwd, `${testDef.title}-${variant.name}`);
    workingDir = prepared.workingDir;
    cleanupRun = prepared.cleanup;
  } else {
    await env.setup(cwd);
  }

  rep.onPipelineStep(event, "setup", "done");
  const setupMs = Date.now() - setupStart;

  const ctx = new EvalContext(workingDir, env);
  ctx.setRunnerInfo({ id: runner.id, model: getRunnerModelId(runner) });
  const start = Date.now();

  const agent: AgentHandle = {
    id: runner.id,
    model: getRunnerModelId(runner),
    variant: { name: variant.name, metadata: variant.metadata },
    run: async () => {
      throw new Error("agent.run() removed. Use ctx.prompt().");
    },
    instruct: () => {
      throw new Error("agent.instruct() removed. Use ctx.prompt().");
    },
  };

  try {
    const beforeEachHooks = getMatchingHooks(getRegisteredBeforeEachHooks(), testDef.suitePath);
    if (config.beforeEach) await config.beforeEach({ ctx });
    for (const hook of beforeEachHooks) await hook.fn({ ctx });

    await testDef.fn({ agent, ctx, judge: config.judge, variant });

    if (!ctx.instruction) {
      throw new Error(
        `Test "${testDef.title}" did not define a mission. Call ctx.prompt() in the test logic.`,
      );
    }

    const finalPrompt = variant.enrichPrompt
      ? variant.enrichPrompt.replace("{{prompt}}", ctx.instruction)
      : ctx.instruction;

    if (variant.enrichPrompt) {
      ctx.setInstruction(finalPrompt);
    }

    const agentStart = Date.now();
    rep.onPipelineStep(event, "agent", "running");
    await executeAgent(runner, finalPrompt, workingDir, env, ctx, rep, testDef.title);
    rep.onPipelineStep(event, "agent", "done");
    const agentMs = Date.now() - agentStart;

    rep.onPipelineStep(event, "diff", "running");
    await ctx.storeDiffAsync();
    rep.onPipelineStep(event, "diff", "done");

    const tasksStart = Date.now();
    const taskResults: TaskResult[] = [];
    for (const task of ctx.tasks) {
      rep.onPipelineStep(event, "task", "running", task.name);
      const actionResult = await task.action({
        exec: (cmd) => ctx.runCommand(cmd.split(/\s+/)[0], cmd),
      });
      const result: CommandResult = {
        name: actionResult.name ?? task.name,
        command: actionResult.command ?? "",
        stdout: actionResult.stdout,
        stderr: actionResult.stderr ?? "",
        exitCode: actionResult.exitCode,
        durationMs: actionResult.durationMs ?? 0,
      };
      taskResults.push({ task, result });
      rep.onPipelineStep(event, "task", "done", task.name);
    }
    const tasksMs = taskResults.length > 0 ? Date.now() - tasksStart : undefined;

    const judgeOptions = getLastJudgeOptions();
    if (!judgeOptions) throw new Error("Test completed without expect(ctx).toPassJudge()");

    const timing: TimingData = { totalMs: Date.now() - start, setupMs, agentMs, tasksMs };
    const executionData = ctx.buildExecutionData(taskResults, timing);

    rep.onPipelineStep(event, "judge", "running");
    const prompt = buildJudgePrompt({
      criteria: judgeOptions.criteria,
      execution: executionData,
      expectedFiles: judgeOptions.expectedFiles,
    });
    const { result: judgeResult, tokenUsage: judgeTokenUsage } = await runJudge(
      ctx,
      prompt,
      config.judge,
    );
    rep.onPipelineStep(event, "judge", "done");

    const thresholds = judgeOptions.thresholds ?? config.thresholds ?? DEFAULT_THRESHOLDS;
    const status = computeStatus(judgeResult.score, thresholds);

    const entry: LedgerEntry = {
      testId: testDef.title,
      suitePath: testDef.suitePath ?? [],
      timestamp: new Date().toISOString(),
      agentRunner: runner.id,
      variantName: variant.name,
      basePrompt: ctx.instruction,
      instruction: finalPrompt,
      diff: ctx.diff,
      changedFiles: executionData.changedFiles,
      commands: ctx.commands,
      taskResults,
      agentTokenUsage: ctx.agentTokenUsage,
      timing: {
        ...timing,
        judgeMs: Date.now() - (start + (timing.agentMs ?? 0) + (timing.tasksMs ?? 0)),
      },
      agentOutput: ctx.agentOutput,
      logs: ctx.logs,
      judgeModel: resolveModelId(config.judge.model),
      score: judgeResult.score,
      pass: status !== "FAIL",
      status,
      reason: judgeResult.reason,
      improvement: judgeResult.improvement,
      judgeTokenUsage,
      criteria: judgeOptions.criteria,
      expectedFiles: judgeOptions.expectedFiles,
      thresholds,
      durationMs: Date.now() - start,
    };

    const rEvent = { ...event, entry, durationMs: entry.durationMs };
    if (entry.status === "PASS") rep.onTestPass(rEvent);
    else if (entry.status === "WARN") rep.onTestWarn(rEvent);
    else rep.onTestFail(rEvent);

    return entry;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    rep.onTestError(event, errorMsg);
    return {
      testId: testDef.title,
      status: "FAIL",
      reason: errorMsg,
      thresholds: config.thresholds ?? DEFAULT_THRESHOLDS,
      durationMs: 0,
      timestamp: new Date().toISOString(),
      agentRunner: runner.id,
      pass: false,
      score: 0,
      judgeModel: "error",
      improvement: "",
      logs: "",
      criteria: "",
      suitePath: testDef.suitePath ?? [],
    } as any;
  } finally {
    if (cleanupRun) await cleanupRun();
    else if (env.teardownRun) await env.teardownRun(cwd, workingDir);
  }
}

// Global store helpers
const STORE_KEY = "__agenteval_judge_store__";
function getStore() {
  const g = globalThis as any;
  if (!g[STORE_KEY]) g[STORE_KEY] = { lastOptions: null, reporter: null, currentEvent: null };
  return g[STORE_KEY];
}
export function setLastJudgeOptions(o: JudgeOptions) {
  getStore().lastOptions = o;
}
export function getLastJudgeOptions(): JudgeOptions | null {
  return getStore().lastOptions;
}
export function clearLastJudgeOptions() {
  getStore().lastOptions = null;
}
export function setJudgeReporterContext(r: any, e: any) {
  const s = getStore();
  s.reporter = r;
  s.currentEvent = e;
}
export function getJudgeReporterContext() {
  const s = getStore();
  return s.reporter ? { reporter: s.reporter, event: s.currentEvent } : null;
}
export function clearJudgeReporterContext() {
  const s = getStore();
  s.reporter = null;
  s.currentEvent = null;
}

export async function dryRunTest(testDef: TestDefinition, config: AgentEvalConfig): Promise<any> {
  return { testId: testDef.title, variants: testDef.variants };
}
