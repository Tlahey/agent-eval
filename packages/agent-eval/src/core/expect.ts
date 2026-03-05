import { judge as runJudge, buildJudgePrompt, extractChangedFiles } from "../judge/judge.js";
import { setLastJudgeOptions, setLastJudgeResult, getJudgeReporterContext } from "./runner.js";
import type {
  ExpectChain,
  JudgeConfig,
  JudgeOptions,
  JudgeResult,
  TestContext,
  Thresholds,
} from "./types.js";
import { computeStatus, DEFAULT_THRESHOLDS } from "./types.js";

// ─── Global judge config (via globalThis for cross-instance singleton) ───

const EXPECT_KEY = Symbol.for("__agenteval_expect__");

interface ExpectGlobals {
  judgeConfig: JudgeConfig | null;
  globalThresholds: Thresholds;
}

function getExpectGlobals(): ExpectGlobals {
  const g = globalThis as Record<symbol, ExpectGlobals | undefined>;
  if (!g[EXPECT_KEY]) {
    g[EXPECT_KEY] = {
      judgeConfig: null,
      globalThresholds: DEFAULT_THRESHOLDS,
    };
  }
  return g[EXPECT_KEY]!;
}

export function setJudgeConfig(config: JudgeConfig): void {
  getExpectGlobals().judgeConfig = config;
}

export function setGlobalThresholds(thresholds: Thresholds): void {
  getExpectGlobals().globalThresholds = thresholds;
}

export function getGlobalThresholds(): Thresholds {
  return getExpectGlobals().globalThresholds;
}

/** @internal Reset judge config – used by tests only */
export function clearJudgeConfig(): void {
  const g = getExpectGlobals();
  g.judgeConfig = null;
  g.globalThresholds = DEFAULT_THRESHOLDS;
}

/**
 * Create the fluent expect chain for a test context.
 *
 * Usage:
 *   await expect(ctx).toPassJudge({ criteria: "..." });
 *   await expect(ctx).toPassJudge({ criteria: "...", thresholds: { warn: 0.7, fail: 0.4 } });
 */
export function expect(ctx: TestContext): ExpectChain {
  return {
    async toPassJudge(options: JudgeOptions): Promise<JudgeResult> {
      const globals = getExpectGlobals();
      if (!globals.judgeConfig) {
        throw new Error(
          "Judge config not set. Make sure you are running inside an agenteval test.",
        );
      }

      // Always record the requested judge options so the runner can enforce
      // and apply criteria/model/thresholds consistently across modes.
      setLastJudgeOptions(options);

      // Declarative mode: before agent execution, diff is not captured yet.
      // Defer evaluation to the runner after instruction + tasks have executed.
      if (ctx.diff === null) {
        return {
          pass: true,
          status: "PASS",
          score: 1,
          reason:
            "Deferred judge evaluation registered. The runner will execute the judge after agent.instruct() and tasks complete.",
          improvement: "No improvement needed.",
        };
      }

      const prompt = buildJudgePrompt({
        criteria: options.criteria,
        execution: {
          instruction: "",
          runner: { name: "unknown", model: "unknown" },
          diff: ctx.diff,
          changedFiles: extractChangedFiles(ctx.diff),
          commands: ctx.commands,
          taskResults: [],
          timing: { totalMs: 0 },
          logs: ctx.logs,
        },
        expectedFiles: options.expectedFiles,
      });

      // Emit judge pipeline step via global reporter context
      const rCtx = getJudgeReporterContext();
      if (rCtx) rCtx.reporter.onPipelineStep(rCtx.event, "judge", "running");

      let result: JudgeResult;
      try {
        const judgeCall = await runJudge(ctx, prompt, globals.judgeConfig);
        result = judgeCall.result;
      } catch (err) {
        if (rCtx) rCtx.reporter.onPipelineStep(rCtx.event, "judge", "error");
        throw err;
      }

      if (rCtx) rCtx.reporter.onPipelineStep(rCtx.event, "judge", "done");

      // Compute status from thresholds (per-test > global > defaults)
      const thresholds = options.thresholds ?? globals.globalThresholds;
      const status = computeStatus(result.score, thresholds);
      const enriched: JudgeResult = {
        ...result,
        pass: status !== "FAIL",
        status,
      };

      // Store result so the runner can capture it
      setLastJudgeResult(enriched);

      if (status === "FAIL") {
        const error = new Error(
          `Score below threshold (${result.score.toFixed(2)} < ${thresholds.fail.toFixed(2)})\n\n${result.reason}\n\n💡 Improvement suggestions:\n${result.improvement}`,
        );
        error.name = "JudgeFailure";
        throw error;
      }

      return enriched;
    },
  };
}
