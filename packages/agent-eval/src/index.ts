import { setJudgeConfig } from "./core/expect.js";
import type { AgentEvalConfig, TestDefinition, TestFn } from "./core/types.js";

// ─── Global test registry ───

const _tests: TestDefinition[] = [];

/** Current describe() scope stack */
let _suiteStack: string[] = [];

/**
 * Register a test. This is the primary DX API.
 *
 * @example
 * ```ts
 * import { test, expect } from "agent-eval";
 *
 * test("Add a Close button to the Banner", async ({ agent, ctx }) => {
 *   await agent.run("Add a Close button inside the banner");
 *   // storeDiff() + afterEach commands run automatically after agent.run()
 *   await expect(ctx).toPassJudge({ criteria: "..." });
 * });
 * ```
 */
export function test(title: string, fn: TestFn): void {
  _tests.push({
    title,
    fn,
    suitePath: _suiteStack.length > 0 ? [..._suiteStack] : undefined,
  });
}

/**
 * Register a tagged test.
 */
test.tagged = function (tags: string[], title: string, fn: TestFn): void {
  _tests.push({
    title,
    fn,
    tags,
    suitePath: _suiteStack.length > 0 ? [..._suiteStack] : undefined,
  });
};

/**
 * Skip a test (register but don't execute).
 */
test.skip = function (_title: string, _fn: TestFn): void {
  // no-op: intentionally not registered
};

/**
 * Group tests into a named suite. Supports nesting.
 *
 * @example
 * ```ts
 * import { test, describe, expect } from "agent-eval";
 *
 * describe("UI Components", () => {
 *   describe("Banner", () => {
 *     test("Add close button", async ({ agent, ctx }) => {
 *       // suitePath = ["UI Components", "Banner"]
 *       await agent.run("...");
 *       await expect(ctx).toPassJudge({ criteria: "..." });
 *     });
 *   });
 * });
 * ```
 */
export function describe(name: string, fn: () => void): void {
  _suiteStack.push(name);
  try {
    fn();
  } finally {
    _suiteStack.pop();
  }
}

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
  _suiteStack = [];
}

/**
 * Set the global judge config for the current run session.
 */
export function initSession(config: AgentEvalConfig): void {
  setJudgeConfig(config.judge);
}

// ─── Re-exports ───

export { expect } from "./core/expect.js";
export { defineConfig } from "./core/config.js";
export type {
  AgentEvalConfig,
  AgentRunnerConfig,
  AfterEachCommand,
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
} from "./core/types.js";
