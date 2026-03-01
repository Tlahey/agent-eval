import { setJudgeConfig, setGlobalThresholds } from "./core/expect.js";
import type {
  AgentEvalConfig,
  HookDefinition,
  HookFn,
  TestDefinition,
  TestFn,
} from "./core/types.js";
import { DEFAULT_THRESHOLDS } from "./core/types.js";

// ─── Global test registry ───

const _tests: TestDefinition[] = [];

/** Current describe() scope stack */
let _suiteStack: string[] = [];

// ─── Global hook registries ───

const _beforeEachHooks: HookDefinition[] = [];
const _afterEachHooks: HookDefinition[] = [];

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
  _beforeEachHooks.length = 0;
  _afterEachHooks.length = 0;
}

// ─── Lifecycle Hooks ───

/**
 * Register a beforeEach hook. Runs before each test in the current scope.
 * Hooks registered inside a describe() block only apply to tests in that block.
 *
 * @example
 * ```ts
 * import { test, describe, beforeEach } from "agent-eval";
 *
 * describe("UI Components", () => {
 *   beforeEach(({ ctx }) => {
 *     ctx.addTask({
 *       name: "typecheck",
 *       action: () => ctx.exec("pnpm tsc --noEmit"),
 *       criteria: "must pass type checking",
 *     });
 *   });
 *
 *   test("Add close button", ({ agent }) => {
 *     agent.instruct("Add a close button to the Banner");
 *   });
 * });
 * ```
 */
export function beforeEach(fn: HookFn): void {
  _beforeEachHooks.push({ fn, suitePath: [..._suiteStack] });
}

/**
 * Register an afterEach hook. Runs after each test in the current scope.
 *
 * @example
 * ```ts
 * afterEach(async ({ ctx }) => {
 *   // Custom cleanup logic
 * });
 * ```
 */
export function afterEach(fn: HookFn): void {
  _afterEachHooks.push({ fn, suitePath: [..._suiteStack] });
}

/**
 * Get hooks matching a test's suite path.
 * A hook matches if its suitePath is a prefix of the test's suitePath.
 */
export function getMatchingHooks(
  hooks: HookDefinition[],
  testSuitePath?: string[],
): HookDefinition[] {
  const path = testSuitePath ?? [];
  return hooks.filter((h) => h.suitePath.every((s, i) => path[i] === s));
}

/**
 * Get all registered beforeEach hooks.
 */
export function getRegisteredBeforeEachHooks(): HookDefinition[] {
  return [..._beforeEachHooks];
}

/**
 * Get all registered afterEach hooks.
 */
export function getRegisteredAfterEachHooks(): HookDefinition[] {
  return [..._afterEachHooks];
}

/**
 * Set the global judge config for the current run session.
 */
export function initSession(config: AgentEvalConfig): void {
  setJudgeConfig(config.judge);
  setGlobalThresholds(config.thresholds ?? DEFAULT_THRESHOLDS);
}

// ─── Re-exports ───

export { expect } from "./core/expect.js";
export { defineConfig, assertValidPlugins } from "./core/config.js";
export {
  DefaultReporter,
  SilentReporter,
  VerboseReporter,
  CIReporter,
  isCI,
} from "./core/reporter.js";
export type {
  Reporter,
  TestEvent,
  TestResultEvent,
  PipelineStep,
  StepStatus,
} from "./core/reporter.js";
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
  ScoreOverride,
  TestFn,
  TestDefinition,
  AgentHandle,
  ExpectChain,
  TestStatus,
  Thresholds,
  TaskDefinition,
  HookFn,
  HookContext,
  HookDefinition,
} from "./core/types.js";
export { DEFAULT_THRESHOLDS, computeStatus } from "./core/types.js";

// ─── Plugin interfaces & implementations ───

export type {
  ILedgerPlugin,
  IJudgePlugin,
  IEnvironmentPlugin,
  EnvironmentCommandResult,
  RunnerStats,
  TestTreeNode,
} from "./core/interfaces.js";

export {
  validatePlugins,
  validateLedgerPlugin,
  validateJudgePlugin,
  validateEnvironmentPlugin,
  formatPluginErrors,
} from "./core/plugin-validator.js";
export type { PluginValidationError } from "./core/plugin-validator.js";
