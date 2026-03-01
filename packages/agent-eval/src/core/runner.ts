import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { EvalContext } from "./context.js";
import { getGlobalThresholds } from "./expect.js";
import { appendLedgerEntry } from "../ledger/ledger.js";
import { judge as runJudge, buildDeclarativeJudgePrompt } from "../judge/judge.js";
import {
  getMatchingHooks,
  getRegisteredBeforeEachHooks,
  getRegisteredAfterEachHooks,
} from "../index.js";
import type {
  AgentEvalConfig,
  AgentHandle,
  AgentRunnerConfig,
  CommandResult,
  JudgeResult,
  LedgerEntry,
  TaskDefinition,
  TestDefinition,
} from "./types.js";
import { computeStatus, DEFAULT_THRESHOLDS } from "./types.js";
import type { ILedgerPlugin, IEnvironmentPlugin } from "./interfaces.js";
import { LocalEnvironment } from "../environment/local-environment.js";
import type { Reporter, TestResultEvent } from "./reporter.js";
import { SilentReporter } from "./reporter.js";

// ─── File operation types for API runner structured output ───

interface FileOperation {
  path: string;
  content: string;
}

interface ApiAgentResponse {
  files: FileOperation[];
}

/**
 * Resolve the AI SDK model for an API runner.
 */
async function resolveRunnerModel(api: NonNullable<AgentRunnerConfig["api"]>) {
  switch (api.provider) {
    case "anthropic": {
      const { createAnthropic } = await import("@ai-sdk/anthropic");
      const provider = createAnthropic({
        apiKey: api.apiKey ?? process.env.ANTHROPIC_API_KEY,
        ...(api.baseURL ? { baseURL: api.baseURL } : {}),
      });
      return provider(api.model);
    }
    case "openai": {
      const { createOpenAI } = await import("@ai-sdk/openai");
      const provider = createOpenAI({
        apiKey: api.apiKey ?? process.env.OPENAI_API_KEY,
        ...(api.baseURL ? { baseURL: api.baseURL } : {}),
      });
      return provider(api.model);
    }
    case "ollama": {
      const { createOpenAI } = await import("@ai-sdk/openai");
      const provider = createOpenAI({
        baseURL: api.baseURL ?? "http://localhost:11434/v1",
        apiKey: "ollama",
      });
      return provider(api.model);
    }
    default:
      throw new Error(`Unsupported API runner provider: ${api.provider}`);
  }
}

/**
 * Create the raw AgentHandle for a given runner config.
 * Uses config.llm plugin for API runners when available, falls back to built-in resolveRunnerModel.
 * CLI runners delegate to the environment plugin for command execution.
 */
function createRawAgent(
  runner: AgentRunnerConfig,
  cwd: string,
  reporter: Reporter,
  testId: string,
  config: AgentEvalConfig,
  env: IEnvironmentPlugin,
): Omit<AgentHandle, "instruct"> {
  return {
    name: runner.name,
    model: runner.api?.model ?? runner.command ?? "unknown",

    async run(prompt: string) {
      if (runner.type === "cli") {
        if (!runner.command) {
          throw new Error(`Runner "${runner.name}" has type "cli" but no command defined`);
        }
        const cmd = runner.command.replace("{{prompt}}", prompt);
        // Use environment plugin for CLI execution
        const result = await env.execute(cmd, cwd, { timeout: 600_000 });
        if (result.exitCode !== 0 && result.stderr) {
          // Log stderr but don't throw — agent may produce partial output
          reporter.onTestError({ testId, runner: runner.name }, result.stderr.slice(0, 500));
        }
      } else if (runner.type === "api") {
        if (!runner.api) {
          throw new Error(`Runner "${runner.name}" has type "api" but no api config defined`);
        }

        // Use ILLMPlugin if available, otherwise fall back to built-in
        if (config.llm?.generate) {
          const result = await config.llm.generate({
            prompt,
            model: runner.api.model,
          });
          for (const file of result.files) {
            const fullPath = resolve(cwd, file.path);
            mkdirSync(dirname(fullPath), { recursive: true });
            writeFileSync(fullPath, file.content, "utf-8");
            reporter.onFileWrite({ testId, runner: runner.name }, file.path);
          }
        } else {
          const { generateObject } = await import("ai");
          const { z } = await import("zod");

          const model = await resolveRunnerModel(runner.api);

          const FileOperationSchema = z.object({
            files: z
              .array(
                z.object({
                  path: z.string().describe("Relative file path from project root"),
                  content: z.string().describe("Full file content to write"),
                }),
              )
              .describe("Files to create or modify"),
          });

          const { object } = await generateObject({
            model,
            schema: FileOperationSchema,
            prompt: `You are an expert coding agent. You must complete the following task by modifying or creating files in a project.

Task: ${prompt}

Respond with the list of files to create or modify. Each file must include the full content (not a diff). Only include files that need changes.`,
          });

          const response = object as ApiAgentResponse;

          // Write files to disk
          for (const file of response.files) {
            const fullPath = resolve(cwd, file.path);
            mkdirSync(dirname(fullPath), { recursive: true });
            writeFileSync(fullPath, file.content, "utf-8");
            reporter.onFileWrite({ testId, runner: runner.name }, file.path);
          }
        }
      } else {
        throw new Error(`Unknown runner type: ${(runner as AgentRunnerConfig).type}`);
      }
    },
  };
}

/**
 * Internal state tracked by the declarative agent handle.
 * Used by the runner to determine which pipeline to execute.
 */
interface AgentState {
  instruction: string | null;
  isDeclarative: boolean;
  isImperative: boolean;
}

/**
 * Create an AgentHandle that supports both imperative (run) and declarative (instruct) modes.
 * Enforces the Single-Instruct Policy and mutual exclusivity of the two modes.
 */
function createAgent(
  runner: AgentRunnerConfig,
  cwd: string,
  ctx: EvalContext,
  config: AgentEvalConfig,
  reporter: Reporter,
  testId: string,
  env: IEnvironmentPlugin,
): { agent: AgentHandle; state: AgentState } {
  const raw = createRawAgent(runner, cwd, reporter, testId, config, env);
  const state: AgentState = {
    instruction: null,
    isDeclarative: false,
    isImperative: false,
  };

  const agent: AgentHandle = {
    name: raw.name,
    model: raw.model,

    instruct(prompt: string): void {
      if (state.isImperative) {
        throw new Error("Cannot use instruct() after run(). Choose one API style per test.");
      }
      if (state.instruction !== null) {
        throw new Error(
          "Single-Instruct Policy: A test can only have one instruction. Use separate test() blocks for different prompts.",
        );
      }
      state.instruction = prompt;
      state.isDeclarative = true;
    },

    async run(prompt: string) {
      if (state.isDeclarative) {
        throw new Error("Cannot use run() after instruct(). Choose one API style per test.");
      }
      state.isImperative = true;

      // Execute the agent
      await raw.run(prompt);

      // Auto storeDiff after agent execution (async for env plugins)
      await ctx.storeDiffAsync();

      // Run afterEach commands from config
      if (config.afterEach) {
        for (const cmd of config.afterEach) {
          await ctx.runCommand(cmd.name, cmd.command);
        }
      }
    },
  };

  return { agent, state };
}

/**
 * Execute the raw agent instruction (without storeDiff/afterEach wrapping).
 * Used by the declarative pipeline where the runner controls the full lifecycle.
 */
async function executeRawAgent(
  runner: AgentRunnerConfig,
  cwd: string,
  prompt: string,
  reporter: Reporter,
  testId: string,
  config: AgentEvalConfig,
  env: IEnvironmentPlugin,
): Promise<void> {
  const raw = createRawAgent(runner, cwd, reporter, testId, config, env);
  await raw.run(prompt);
}

export interface RunResult {
  testId: string;
  runner: string;
  entries: LedgerEntry[];
  passed: boolean;
}

/**
 * Information about a test execution plan (for dry-run mode).
 */
export interface DryRunPlan {
  testId: string;
  suitePath?: string[];
  runners: Array<{
    name: string;
    type: string;
    model: string;
  }>;
  mode: "declarative" | "imperative" | "unknown";
  instruction?: string;
  tasks: Array<{ name: string; criteria: string; weight: number }>;
  beforeEachHooks: number;
  afterEachHooks: number;
  afterEachCommands: string[];
}

/**
 * Run a test in dry-run mode: parse and return the execution plan without side effects.
 */
export async function dryRunTest(
  testDef: TestDefinition,
  config: AgentEvalConfig,
): Promise<DryRunPlan> {
  const runners = config.matrix?.runners
    ? config.runners.filter((r) => config.matrix!.runners!.includes(r.name))
    : config.runners;

  // Create a mock context that captures addTask calls but does nothing
  const tasks: Array<{ name: string; criteria: string; weight: number }> = [];
  let instruction: string | undefined;
  let mode: "declarative" | "imperative" | "unknown" = "unknown";

  // Create a mock agent to detect which mode the test uses
  const mockAgent: AgentHandle = {
    name: "dry-run",
    model: "dry-run",
    instruct(prompt: string) {
      instruction = prompt;
      mode = "declarative";
    },
    async run(_prompt: string) {
      mode = "imperative";
    },
  };

  // Create a mock context to capture tasks
  const mockCtx = {
    storeDiff: () => {},
    runCommand: async () => ({
      name: "",
      command: "",
      stdout: "",
      stderr: "",
      exitCode: 0,
      durationMs: 0,
    }),
    addTask: (task: TaskDefinition) => {
      tasks.push({ name: task.name, criteria: task.criteria, weight: task.weight ?? 1 });
    },
    exec: async () => ({
      name: "",
      command: "",
      stdout: "",
      stderr: "",
      exitCode: 0,
      durationMs: 0,
    }),
    get diff() {
      return null;
    },
    get commands() {
      return [];
    },
    get tasks() {
      return tasks as unknown as ReadonlyArray<TaskDefinition>;
    },
    get logs() {
      return "";
    },
  };

  // Run config-level beforeEach to capture tasks
  if (config.beforeEach) {
    await config.beforeEach({ ctx: mockCtx });
  }

  // Run DSL-level beforeEach hooks to capture tasks they register
  const beforeEachHooks = getMatchingHooks(getRegisteredBeforeEachHooks(), testDef.suitePath);
  for (const hook of beforeEachHooks) {
    await hook.fn({ ctx: mockCtx });
  }

  // Execute the test function with mock agent/context
  try {
    await testDef.fn({ agent: mockAgent, ctx: mockCtx, judge: config.judge });
  } catch {
    // Ignore errors in dry-run mode
  }

  const afterEachHooks = getMatchingHooks(getRegisteredAfterEachHooks(), testDef.suitePath);

  return {
    testId: testDef.title,
    suitePath: testDef.suitePath,
    runners: runners.map((r) => ({
      name: r.name,
      type: r.type,
      model: r.api?.model ?? r.command ?? "unknown",
    })),
    mode,
    instruction,
    tasks,
    beforeEachHooks: beforeEachHooks.length,
    afterEachHooks: afterEachHooks.length,
    afterEachCommands: (config.afterEach ?? []).map((c) => c.command),
  };
}

/**
 * Run a single test definition against all configured runners, sequentially.
 * Supports both imperative (agent.run) and declarative (agent.instruct) pipelines.
 * Uses config.ledger (ILedgerPlugin) when provided, otherwise falls back to appendLedgerEntry.
 * Uses config.environment (IEnvironmentPlugin) when provided, otherwise falls back to LocalEnvironment.
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
  const runners = config.matrix?.runners
    ? config.runners.filter((r) => config.matrix!.runners!.includes(r.name))
    : config.runners;

  /** Record entry via plugin or fallback */
  const record = (entry: LedgerEntry): void | Promise<void> => {
    if (ledger) return ledger.recordRun(entry);
    appendLedgerEntry(outputDir, entry);
  };

  // Get matching lifecycle hooks
  const beforeEachHooks = getMatchingHooks(getRegisteredBeforeEachHooks(), testDef.suitePath);
  const afterEachHooks = getMatchingHooks(getRegisteredAfterEachHooks(), testDef.suitePath);

  const allEvents: TestResultEvent[] = [];
  const results: RunResult[] = [];

  for (const runner of runners) {
    const event = { testId: testDef.title, runner: runner.name, suitePath: testDef.suitePath };
    rep.onTestStart(event);

    // Setup workspace via environment plugin (git reset, docker create, etc.)
    rep.onGitReset(event);
    await env.setup(cwd);

    const ctx = new EvalContext(cwd, env);
    const { agent, state } = createAgent(runner, cwd, ctx, config, rep, testDef.title, env);
    const start = Date.now();
    const thresholds = config.thresholds ?? getGlobalThresholds?.() ?? DEFAULT_THRESHOLDS;

    try {
      // Run config-level beforeEach (runs before DSL hooks)
      if (config.beforeEach) {
        await config.beforeEach({ ctx });
      }

      // Run beforeEach hooks (DSL-level)
      for (const hook of beforeEachHooks) {
        await hook.fn({ ctx });
      }

      // Execute the test function (registers instruction/tasks or calls run)
      await testDef.fn({ agent, ctx, judge: config.judge });

      let entry: LedgerEntry;

      if (state.isDeclarative) {
        // ─── DECLARATIVE PIPELINE ───
        entry = await executeDeclarativePipeline(
          state.instruction!,
          runner,
          cwd,
          ctx,
          config,
          rep,
          testDef,
          env,
          start,
          thresholds,
        );
      } else {
        // ─── IMPERATIVE PIPELINE (legacy: agent.run() was called) ───
        entry = buildImperativeEntry(testDef, runner, ctx, config, start, thresholds);
      }

      await record(entry);

      const resultEvent = { ...event, entry, durationMs: entry.durationMs };
      if (entry.status === "PASS") {
        rep.onTestPass(resultEvent);
      } else if (entry.status === "WARN") {
        rep.onTestWarn(resultEvent);
      } else {
        rep.onTestFail(resultEvent);
      }
      allEvents.push(resultEvent);

      results.push({
        testId: testDef.title,
        runner: runner.name,
        entries: [entry],
        passed: entry.pass,
      });

      // Run afterEach hooks
      for (const hook of afterEachHooks) {
        await hook.fn({ ctx });
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      rep.onTestError(event, errorMsg);

      const durationMs = Date.now() - start;
      const entry: LedgerEntry = {
        testId: testDef.title,
        suitePath: testDef.suitePath ?? [],
        timestamp: new Date().toISOString(),
        agentRunner: runner.name,
        judgeModel: config.judge.model ?? config.judge.command ?? "unknown",
        score: 0,
        pass: false,
        status: "FAIL",
        reason: `Execution error: ${errorMsg}`,
        improvement: "",
        context: {
          diff: ctx.diff,
          commands: ctx.commands,
        },
        durationMs,
        thresholds,
      };

      await record(entry);

      // Run afterEach hooks even on error
      for (const hook of afterEachHooks) {
        try {
          await hook.fn({ ctx });
        } catch {
          // Swallow hook errors during error handling
        }
      }

      allEvents.push({ ...event, entry, durationMs });
      results.push({
        testId: testDef.title,
        runner: runner.name,
        entries: [entry],
        passed: false,
      });
    } finally {
      // Teardown environment (no-op for local, removes container for Docker)
      if (env.teardown) {
        await env.teardown(cwd);
      }
    }
  }

  return results;
}

/**
 * Execute the declarative pipeline:
 * 1. Run the agent instruction
 * 2. Auto storeDiff
 * 3. Run config afterEach commands
 * 4. Execute registered tasks
 * 5. Auto judge evaluation from task criteria
 */
async function executeDeclarativePipeline(
  instruction: string,
  runner: AgentRunnerConfig,
  cwd: string,
  ctx: EvalContext,
  config: AgentEvalConfig,
  reporter: Reporter,
  testDef: TestDefinition,
  env: IEnvironmentPlugin,
  start: number,
  thresholds: import("./types.js").Thresholds,
): Promise<LedgerEntry> {
  // 1. Execute the agent instruction
  await executeRawAgent(runner, cwd, instruction, reporter, testDef.title, config, env);

  // 2. Auto storeDiff
  await ctx.storeDiffAsync();

  // 3. Run config afterEach commands
  if (config.afterEach) {
    for (const cmd of config.afterEach) {
      await ctx.runCommand(cmd.name, cmd.command);
    }
  }

  // 4. Execute registered tasks and collect results
  const taskResults: Array<{ task: TaskDefinition; result: CommandResult }> = [];
  for (const task of ctx.tasks) {
    const result = await task.action();
    taskResults.push({ task, result });
  }

  // 5. Auto judge evaluation
  const durationMs = Date.now() - start;

  if (taskResults.length > 0) {
    // Build a weighted judge prompt from task criteria
    const prompt = buildDeclarativeJudgePrompt(instruction, taskResults, ctx);
    const judgeResult = await runJudge(ctx, prompt, config.judge);

    const status = computeStatus(judgeResult.score, thresholds);
    return {
      testId: testDef.title,
      suitePath: testDef.suitePath ?? [],
      timestamp: new Date().toISOString(),
      agentRunner: runner.name,
      judgeModel: config.judge.model ?? config.judge.command ?? "unknown",
      score: judgeResult.score,
      pass: status !== "FAIL",
      status,
      reason: judgeResult.reason,
      improvement: judgeResult.improvement,
      context: {
        diff: ctx.diff,
        commands: ctx.commands,
      },
      durationMs,
      thresholds,
    };
  }

  // No tasks registered — check if expect().toPassJudge() was used
  const judgeResult = getLastJudgeResult();
  if (judgeResult) {
    const status = judgeResult.status ?? computeStatus(judgeResult.score, thresholds);
    clearLastJudgeResult();
    return {
      testId: testDef.title,
      suitePath: testDef.suitePath ?? [],
      timestamp: new Date().toISOString(),
      agentRunner: runner.name,
      judgeModel: config.judge.model ?? config.judge.command ?? "unknown",
      score: judgeResult.score,
      pass: judgeResult.pass,
      status,
      reason: judgeResult.reason,
      improvement: judgeResult.improvement,
      context: {
        diff: ctx.diff,
        commands: ctx.commands,
      },
      durationMs,
      thresholds,
    };
  }

  // Declarative with no tasks and no judge — record as incomplete
  return {
    testId: testDef.title,
    suitePath: testDef.suitePath ?? [],
    timestamp: new Date().toISOString(),
    agentRunner: runner.name,
    judgeModel: config.judge.model ?? config.judge.command ?? "unknown",
    score: 0,
    pass: false,
    status: "FAIL",
    reason: "Declarative test completed without tasks or judge evaluation",
    improvement: "Add ctx.addTask() calls to define evaluation criteria",
    context: {
      diff: ctx.diff,
      commands: ctx.commands,
    },
    durationMs,
    thresholds,
  };
}

/**
 * Build a ledger entry for the imperative pipeline (agent.run + optional expect).
 */
function buildImperativeEntry(
  testDef: TestDefinition,
  runner: AgentRunnerConfig,
  ctx: EvalContext,
  config: AgentEvalConfig,
  start: number,
  thresholds: import("./types.js").Thresholds,
): LedgerEntry {
  const durationMs = Date.now() - start;
  const entry: LedgerEntry = {
    testId: testDef.title,
    suitePath: testDef.suitePath ?? [],
    timestamp: new Date().toISOString(),
    agentRunner: runner.name,
    judgeModel: config.judge.model ?? config.judge.command ?? "unknown",
    score: 0,
    pass: false,
    status: "FAIL",
    reason: "Test completed without judge evaluation",
    improvement: "",
    context: {
      diff: ctx.diff,
      commands: ctx.commands,
    },
    durationMs,
    thresholds,
  };

  const judgeResult = getLastJudgeResult();
  if (judgeResult) {
    entry.score = judgeResult.score;
    entry.pass = judgeResult.pass;
    entry.status = judgeResult.status ?? computeStatus(judgeResult.score, thresholds);
    entry.reason = judgeResult.reason;
    entry.improvement = judgeResult.improvement;
    clearLastJudgeResult();
  } else {
    entry.status = computeStatus(entry.score, thresholds);
    entry.pass = entry.status !== "FAIL";
  }

  return entry;
}

// ─── Global judge result store (set by expect().toPassJudge) ───

let _lastJudgeResult: JudgeResult | null = null;

export function setLastJudgeResult(result: JudgeResult): void {
  _lastJudgeResult = result;
}

export function getLastJudgeResult(): JudgeResult | null {
  return _lastJudgeResult;
}

export function clearLastJudgeResult(): void {
  _lastJudgeResult = null;
}
