import { judge as runJudge } from "../judge/judge.js";
import { setLastJudgeOptions, setLastJudgeResult } from "./runner.js";
import type {
  ExpectChain,
  JudgeConfig,
  JudgeOptions,
  JudgeResult,
  TestContext,
  Thresholds,
} from "./types.js";
import { computeStatus, DEFAULT_THRESHOLDS } from "./types.js";

// ─── Global judge config (set during test execution) ───

let _judgeConfig: JudgeConfig | null = null;
let _globalThresholds: Thresholds = DEFAULT_THRESHOLDS;

export function setJudgeConfig(config: JudgeConfig): void {
  _judgeConfig = config;
}

export function setGlobalThresholds(thresholds: Thresholds): void {
  _globalThresholds = thresholds;
}

export function getGlobalThresholds(): Thresholds {
  return _globalThresholds;
}

/** @internal Reset judge config – used by tests only */
export function clearJudgeConfig(): void {
  _judgeConfig = null;
  _globalThresholds = DEFAULT_THRESHOLDS;
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
      if (!_judgeConfig) {
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

      const result = await runJudge(
        ctx,
        options.criteria,
        _judgeConfig,
        options.model,
        options.expectedFiles,
      );

      // Compute status from thresholds (per-test > global > defaults)
      const thresholds = options.thresholds ?? _globalThresholds;
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
          `Judge evaluation failed (score: ${result.score.toFixed(2)})\n\n${result.reason}\n\n💡 Improvement suggestions:\n${result.improvement}`,
        );
        error.name = "JudgeFailure";
        throw error;
      }

      return enriched;
    },
  };
}
