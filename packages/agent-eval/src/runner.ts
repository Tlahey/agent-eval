import { execSync } from "node:child_process";
import chalk from "chalk";
import { EvalContext } from "./context.js";
import { gitResetHard } from "./git.js";
import { appendLedgerEntry } from "./ledger.js";
import type {
  AgentEvalConfig,
  AgentHandle,
  AgentRunnerConfig,
  LedgerEntry,
  TestDefinition,
} from "./types.js";

/**
 * Create an AgentHandle for a given runner config.
 */
function createAgent(runner: AgentRunnerConfig, cwd: string): AgentHandle {
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
        // API-based agent: we send the prompt to the model and let it modify files
        // This will be extended later for full API agent support
        throw new Error(
          `API-based runners are not yet implemented. Use type: "cli" for now.`
        );
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
  config: AgentEvalConfig
): Promise<RunResult[]> {
  const cwd = config.rootDir ?? process.cwd();
  const outputDir = config.outputDir ?? ".agenteval";
  const runners = config.matrix?.runners
    ? config.runners.filter((r) => config.matrix!.runners!.includes(r.name))
    : config.runners;

  const results: RunResult[] = [];

  for (const runner of runners) {
    console.log(
      chalk.blue(`\n▶ ${testDef.title}`) +
        chalk.gray(` [${runner.name}]`)
    );

    // Reset git state before each runner
    console.log(chalk.dim("  ↺ git reset --hard && git clean -fd"));
    gitResetHard(cwd);

    const ctx = new EvalContext(cwd);
    const agent = createAgent(runner, cwd);
    const start = Date.now();

    try {
      await testDef.fn({ agent, ctx, judge: config.judge });

      const entry: LedgerEntry = {
        testId: testDef.title,
        timestamp: new Date().toISOString(),
        agentRunner: runner.name,
        judgeModel: config.judge.model,
        score: 0,
        pass: false,
        reason: "Test completed without judge evaluation",
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
        clearLastJudgeResult();
      }

      appendLedgerEntry(outputDir, entry);

      const icon = entry.pass ? chalk.green("✓") : chalk.red("✗");
      const scoreStr = chalk.yellow(`${entry.score.toFixed(2)}`);
      console.log(
        `  ${icon} Score: ${scoreStr} – ${entry.pass ? "PASS" : "FAIL"}`
      );

      results.push({
        testId: testDef.title,
        runner: runner.name,
        entries: [entry],
        passed: entry.pass,
      });
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : String(err);

      console.log(chalk.red(`  ✗ Error: ${errorMsg}`));

      const entry: LedgerEntry = {
        testId: testDef.title,
        timestamp: new Date().toISOString(),
        agentRunner: runner.name,
        judgeModel: config.judge.model,
        score: 0,
        pass: false,
        reason: `Execution error: ${errorMsg}`,
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

let _lastJudgeResult: { pass: boolean; score: number; reason: string } | null =
  null;

export function setLastJudgeResult(result: {
  pass: boolean;
  score: number;
  reason: string;
}): void {
  _lastJudgeResult = result;
}

export function getLastJudgeResult() {
  return _lastJudgeResult;
}

export function clearLastJudgeResult() {
  _lastJudgeResult = null;
}
