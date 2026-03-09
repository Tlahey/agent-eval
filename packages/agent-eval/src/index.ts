import { setJudgeConfig, setGlobalThresholds } from "./core/expect.js";
import type {
  AgentEvalConfig,
  HookDefinition,
  HookFn,
  TestDefinition,
  TestFn,
  TestVariant,
} from "./core/types.js";
import { DEFAULT_THRESHOLDS } from "./core/types.js";

// ─── Global test registry (via globalThis for cross-instance singleton) ───

const REGISTRY_KEY = Symbol.for("__agenteval_registry__");

interface AgentEvalRegistry {
  tests: TestDefinition[];
  suiteStack: string[];
  beforeEachHooks: HookDefinition[];
  afterEachHooks: HookDefinition[];
}

function getRegistry(): AgentEvalRegistry {
  const g = globalThis as Record<symbol, AgentEvalRegistry | undefined>;
  if (!g[REGISTRY_KEY]) {
    g[REGISTRY_KEY] = {
      tests: [],
      suiteStack: [],
      beforeEachHooks: [],
      afterEachHooks: [],
    };
  }
  return g[REGISTRY_KEY]!;
}

/**
 * Unified Test Registration API.
 *
 * Supports both standard runs and A/B experiments.
 *
 * @example
 * // Standard
 * test("Refactor Header", async ({ ctx }) => {
 *   ctx.prompt("Refactor this component...");
 *   await expect(ctx).toPassJudge({ criteria: "..." });
 * });
 *
 * @example
 * // Experiment
 * test("Refactor Header", [ { id: 'v1', runnerId: 'sonnet' }, ... ], async ({ ctx }) => {
 *   ctx.prompt("Refactor this component...");
 *   await expect(ctx).toPassJudge({ criteria: "..." });
 * });
 */
export function test(title: string, variantsOrFn: TestVariant[] | TestFn, maybeFn?: TestFn): void {
  const reg = getRegistry();
  const variants = Array.isArray(variantsOrFn) ? variantsOrFn : undefined;
  const fn = Array.isArray(variantsOrFn) ? maybeFn! : variantsOrFn;

  reg.tests.push({
    title,
    fn,
    variants,
    suitePath: reg.suiteStack.length > 0 ? [...reg.suiteStack] : undefined,
  });
}

/**
 * Skip a test.
 */
test.skip = function (_title: string, _variantsOrFn: any, _maybeFn?: any): void {
  // no-op
};

/**
 * Group tests into a named suite.
 */
export function describe(name: string, fn: () => void): void {
  const reg = getRegistry();
  reg.suiteStack.push(name);
  try {
    fn();
  } finally {
    reg.suiteStack.pop();
  }
}

/**
 * Get all registered tests.
 */
export function getRegisteredTests(): TestDefinition[] {
  return [...getRegistry().tests];
}

/**
 * Clear all registered tests (used between file loads).
 */
export function clearRegisteredTests(): void {
  const reg = getRegistry();
  reg.tests.length = 0;
  reg.suiteStack.length = 0;
  reg.beforeEachHooks.length = 0;
  reg.afterEachHooks.length = 0;
}

// ─── Lifecycle Hooks ───

/**
 * Register a beforeEach hook.
 */
export function beforeEach(fn: HookFn): void {
  const reg = getRegistry();
  reg.beforeEachHooks.push({ fn, suitePath: [...reg.suiteStack] });
}

/**
 * Register an afterEach hook.
 */
export function afterEach(fn: HookFn): void {
  const reg = getRegistry();
  reg.afterEachHooks.push({ fn, suitePath: [...reg.suiteStack] });
}

/**
 * Get hooks matching a test's suite path.
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
  return [...getRegistry().beforeEachHooks];
}

/**
 * Get all registered afterEach hooks.
 */
export function getRegisteredAfterEachHooks(): HookDefinition[] {
  return [...getRegistry().afterEachHooks];
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
  LivePanel,
  Spinner,
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
  TaskActionResult,
  HookFn,
  HookContext,
  HookDefinition,
  TokenUsage,
  TaskResult,
  TimingData,
  ExecutionData,
  JudgmentData,
  RunReport,
  RunnerConfig,
  LlmConfig,
  TestVariant,
} from "./core/types.js";
export { DEFAULT_THRESHOLDS, computeStatus } from "./core/types.js";
export { validateRunnerNames } from "./core/config.js";

// ─── Plugin interfaces & implementations ───

export type {
  IModelPlugin,
  ModelSettings,
  ICliModel,
  CliOutputMetrics,
  CliOutputParser,
  RunnerContext,
  RunnerExecResult,
  ILedgerPlugin,
  IJudgePlugin,
  IEnvironmentPlugin,
  EnvironmentCommandResult,
  EnvironmentExecOptions,
  RunnerStats,
  TestTreeNode,
} from "./core/interfaces.js";
export { isCliModel } from "./core/interfaces.js";

export {
  validatePlugins,
  validateLedgerPlugin,
  validateJudgePlugin,
  validateEnvironmentPlugin,
  validateModelPlugin,
  formatPluginErrors,
} from "./core/plugin-validator.js";
export type { PluginValidationError } from "./core/plugin-validator.js";

// ─── Debug utilities ───

export { setDebug, isDebug, debug } from "./core/debug.js";
export { env } from "./core/env.js";
