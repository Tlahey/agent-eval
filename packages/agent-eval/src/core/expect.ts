import { judge as runJudge } from "../judge/judge.js";
import { setLastJudgeResult } from "./runner.js";
import type { ExpectChain, JudgeConfig, JudgeOptions, JudgeResult, TestContext } from "./types.js";

// ─── Global judge config (set during test execution) ───

let _judgeConfig: JudgeConfig | null = null;

export function setJudgeConfig(config: JudgeConfig): void {
  _judgeConfig = config;
}

/** @internal Reset judge config – used by tests only */
export function clearJudgeConfig(): void {
  _judgeConfig = null;
}

/**
 * Create the fluent expect chain for a test context.
 *
 * Usage:
 *   await expect(ctx).toPassJudge({ criteria: "..." });
 */
export function expect(ctx: TestContext): ExpectChain {
  return {
    async toPassJudge(options: JudgeOptions): Promise<JudgeResult> {
      if (!_judgeConfig) {
        throw new Error(
          "Judge config not set. Make sure you are running inside an agenteval test.",
        );
      }

      const result = await runJudge(
        ctx,
        options.criteria,
        _judgeConfig,
        options.model,
        options.expectedFiles,
      );

      // Store result so the runner can capture it
      setLastJudgeResult(result);

      if (!result.pass) {
        const error = new Error(
          `Judge evaluation failed (score: ${result.score.toFixed(2)})\n\n${result.reason}\n\n💡 Improvement suggestions:\n${result.improvement}`,
        );
        error.name = "JudgeFailure";
        throw error;
      }

      return result;
    },
  };
}
