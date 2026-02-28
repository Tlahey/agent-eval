import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { EvalContext } from "./context.js";
import { getGlobalThresholds } from "./expect.js";
import { gitResetHard } from "../git/git.js";
import { appendLedgerEntry } from "../ledger/ledger.js";
import type {
  AgentEvalConfig,
  AgentHandle,
  AgentRunnerConfig,
  JudgeResult,
  LedgerEntry,
  TestDefinition,
} from "./types.js";
import { computeStatus, DEFAULT_THRESHOLDS } from "./types.js";
import type { ILedgerPlugin } from "./interfaces.js";
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
 */
function createRawAgent(
  runner: AgentRunnerConfig,
  cwd: string,
  reporter: Reporter,
  testId: string,
  config: AgentEvalConfig,
): AgentHandle {
  return {
    name: runner.name,
    model: runner.api?.model ?? runner.command ?? "unknown",

    async run(prompt: string) {
      if (runner.type === "cli") {
        if (!runner.command) {
          throw new Error(`Runner "${runner.name}" has type "cli" but no command defined`);
        }
        const cmd = runner.command.replace("{{prompt}}", prompt);
        execSync(cmd, {
          cwd,
          stdio: "inherit",
          timeout: 600_000,
        });
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
 * Wrap an AgentHandle to auto-run storeDiff + afterEach commands after agent.run().
 */
function createAgent(
  runner: AgentRunnerConfig,
  cwd: string,
  ctx: EvalContext,
  config: AgentEvalConfig,
  reporter: Reporter,
  testId: string,
): AgentHandle {
  const raw = createRawAgent(runner, cwd, reporter, testId, config);

  return {
    name: raw.name,
    model: raw.model,

    async run(prompt: string) {
      // Execute the agent
      await raw.run(prompt);

      // Auto storeDiff after agent execution
      ctx.storeDiff();

      // Run afterEach commands from config
      if (config.afterEach) {
        for (const cmd of config.afterEach) {
          await ctx.runCommand(cmd.name, cmd.command);
        }
      }
    },
  };
}

export interface RunResult {
  testId: string;
  runner: string;
  entries: LedgerEntry[];
  passed: boolean;
}

/**
 * Run a single test definition against all configured runners, sequentially.
 * Uses config.ledger (ILedgerPlugin) when provided, otherwise falls back to appendLedgerEntry.
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
  const runners = config.matrix?.runners
    ? config.runners.filter((r) => config.matrix!.runners!.includes(r.name))
    : config.runners;

  /** Record entry via plugin or fallback */
  const record = (entry: LedgerEntry): void | Promise<void> => {
    if (ledger) return ledger.recordRun(entry);
    appendLedgerEntry(outputDir, entry);
  };

  const allEvents: TestResultEvent[] = [];
  const results: RunResult[] = [];

  for (const runner of runners) {
    const event = { testId: testDef.title, runner: runner.name, suitePath: testDef.suitePath };
    rep.onTestStart(event);

    // Reset git state before each runner
    rep.onGitReset(event);
    gitResetHard(cwd);

    const ctx = new EvalContext(cwd);
    const agent = createAgent(runner, cwd, ctx, config, rep, testDef.title);
    const start = Date.now();
    const thresholds = config.thresholds ?? getGlobalThresholds?.() ?? DEFAULT_THRESHOLDS;

    try {
      await testDef.fn({ agent, ctx, judge: config.judge });

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

      // If the test fn stored judge results via expect(), they'll be in the
      // global store. Otherwise, we record a basic entry.
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

      await record(entry);

      const resultEvent = { ...event, entry, durationMs };
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
      allEvents.push({ ...event, entry, durationMs });
      results.push({
        testId: testDef.title,
        runner: runner.name,
        entries: [entry],
        passed: false,
      });
    }
  }

  return results;
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
