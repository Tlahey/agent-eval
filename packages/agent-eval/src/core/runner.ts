import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import chalk from "chalk";
import { EvalContext } from "./context.js";
import { gitResetHard } from "../git/git.js";
import { appendLedgerEntry } from "../ledger/ledger.js";
import type {
  AgentEvalConfig,
  AgentHandle,
  AgentRunnerConfig,
  LedgerEntry,
  TestDefinition,
} from "./types.js";

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
 */
function createRawAgent(runner: AgentRunnerConfig, cwd: string): AgentHandle {
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
          console.log(chalk.dim(`  📝 wrote ${file.path}`));
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
): AgentHandle {
  const raw = createRawAgent(runner, cwd);

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
 */
export async function runTest(
  testDef: TestDefinition,
  config: AgentEvalConfig,
): Promise<RunResult[]> {
  const cwd = config.rootDir ?? process.cwd();
  const outputDir = config.outputDir ?? ".agenteval";
  const runners = config.matrix?.runners
    ? config.runners.filter((r) => config.matrix!.runners!.includes(r.name))
    : config.runners;

  const results: RunResult[] = [];

  for (const runner of runners) {
    console.log(chalk.blue(`\n▶ ${testDef.title}`) + chalk.gray(` [${runner.name}]`));

    // Reset git state before each runner
    console.log(chalk.dim("  ↺ git reset --hard && git clean -fd"));
    gitResetHard(cwd);

    const ctx = new EvalContext(cwd);
    const agent = createAgent(runner, cwd, ctx, config);
    const start = Date.now();

    try {
      await testDef.fn({ agent, ctx, judge: config.judge });

      const entry: LedgerEntry = {
        testId: testDef.title,
        suitePath: testDef.suitePath ?? [],
        timestamp: new Date().toISOString(),
        agentRunner: runner.name,
        judgeModel: config.judge.model ?? config.judge.command ?? "unknown",
        score: 0,
        pass: false,
        reason: "Test completed without judge evaluation",
        improvement: "",
        context: {
          diff: ctx.diff,
          commands: ctx.commands,
        },
        durationMs: Date.now() - start,
      };

      // If the test fn stored judge results via expect(), they'll be in the
      // global store. Otherwise, we record a basic entry.
      const judgeResult = getLastJudgeResult();
      if (judgeResult) {
        entry.score = judgeResult.score;
        entry.pass = judgeResult.pass;
        entry.reason = judgeResult.reason;
        entry.improvement = judgeResult.improvement;
        clearLastJudgeResult();
      }

      appendLedgerEntry(outputDir, entry);

      const icon = entry.pass ? chalk.green("✓") : chalk.red("✗");
      const scoreStr = chalk.yellow(`${entry.score.toFixed(2)}`);
      console.log(`  ${icon} Score: ${scoreStr} – ${entry.pass ? "PASS" : "FAIL"}`);

      results.push({
        testId: testDef.title,
        runner: runner.name,
        entries: [entry],
        passed: entry.pass,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);

      console.log(chalk.red(`  ✗ Error: ${errorMsg}`));

      const entry: LedgerEntry = {
        testId: testDef.title,
        suitePath: testDef.suitePath ?? [],
        timestamp: new Date().toISOString(),
        agentRunner: runner.name,
        judgeModel: config.judge.model ?? config.judge.command ?? "unknown",
        score: 0,
        pass: false,
        reason: `Execution error: ${errorMsg}`,
        improvement: "",
        context: {
          diff: ctx.diff,
          commands: ctx.commands,
        },
        durationMs: Date.now() - start,
      };

      appendLedgerEntry(outputDir, entry);
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

let _lastJudgeResult: {
  pass: boolean;
  score: number;
  reason: string;
  improvement: string;
} | null = null;

export function setLastJudgeResult(result: {
  pass: boolean;
  score: number;
  reason: string;
  improvement: string;
}): void {
  _lastJudgeResult = result;
}

export function getLastJudgeResult() {
  return _lastJudgeResult;
}

export function clearLastJudgeResult() {
  _lastJudgeResult = null;
}
