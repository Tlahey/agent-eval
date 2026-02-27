import { setJudgeConfig } from "./expect.js";
import type { AgentEvalConfig, TestDefinition, TestFn } from "./types.js";

// ─── Global test registry ───

const _tests: TestDefinition[] = [];

/**
 * Register a test. This is the primary DX API.
 *
 * @example
 * ```ts
 * import { test, expect } from "@dkt/agent-eval";
 *
 * test("Add a Close button to the Banner", async ({ agent, ctx, judge }) => {
 *   await agent.run("Add a Close button inside the banner");
 *   ctx.storeDiff();
 *   await expect(ctx).toPassJudge({ criteria: "..." });
 * });
 * ```
 */
export function test(title: string, fn: TestFn): void {
  _tests.push({ title, fn });
}

/**
 * Register a tagged test.
 */
test.tagged = function (tags: string[], title: string, fn: TestFn): void {
  _tests.push({ title, fn, tags });
};

/**
 * Skip a test (register but don't execute).
 */
test.skip = function (_title: string, _fn: TestFn): void {
  // no-op: intentionally not registered
};

/**
 * Get all registered tests.
 */
export function getRegisteredTests(): TestDefinition[] {
  return [..._tests];
}

/**
 * Clear all registered tests (used between file loads).
 */
export function clearRegisteredTests(): void {
  _tests.length = 0;
}

/**
 * Set the global judge config for the current run session.
 */
export function initSession(config: AgentEvalConfig): void {
  setJudgeConfig(config.judge);
}

// ─── Re-exports ───

export { expect } from "./expect.js";
export { defineConfig } from "./config.js";
export type {
  AgentEvalConfig,
  AgentRunnerConfig,
  JudgeConfig,
  JudgeOptions,
  JudgeResult,
  TestContext,
  CommandResult,
  LedgerEntry,
  TestFn,
  TestDefinition,
  AgentHandle,
  ExpectChain,
} from "./types.js";
