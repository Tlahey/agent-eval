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

const REGISTRY_KEY = "__agenteval_registry__";

interface AgentEvalRegistry {
  tests: TestDefinition<any>[];
  suiteStack: string[];
  beforeEachHooks: HookDefinition[];
  afterEachHooks: HookDefinition[];
}

function getRegistry(): AgentEvalRegistry {
  const g = globalThis as any;
  if (!g[REGISTRY_KEY]) {
    g[REGISTRY_KEY] = {
      tests: [],
      suiteStack: [],
      beforeEachHooks: [],
      afterEachHooks: [],
    };
  }
  return g[REGISTRY_KEY];
}

/**
 * Define a test (mission) for an agent.
 * All tests must explicitly define at least one variant (baseline).
 */
export function test<TRunnerId extends string = string>(
  title: string,
  variants: TestVariant<TRunnerId>[],
  fn: TestFn<TRunnerId>,
): void {
  const reg = getRegistry();

  if (!variants || variants.length === 0) {
    throw new Error(`Test "${title}" must define at least one variant.`);
  }

  if (!fn) {
    throw new Error(`Test "${title}" is missing its implementation function.`);
  }

  const testDef: TestDefinition<TRunnerId> = {
    title,
    fn,
    variants: [...variants],
    suitePath: reg.suiteStack.length > 0 ? [...reg.suiteStack] : undefined,
  };

  reg.tests.push(testDef);
}

/**
 * Create a type-safe test registration function.
 */
export function createTest<TRunnerId extends string = string>() {
  return (title: string, variants: TestVariant<TRunnerId>[], fn: TestFn<TRunnerId>) =>
    test<TRunnerId>(title, variants, fn);
}

/**
 * Skip a test.
 */
test.skip = function (_title: string, _variants: any, _fn: any): void {
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
export function getRegisteredTests(): TestDefinition<any>[] {
  const reg = getRegistry();
  return reg.tests.map((t) => ({
    ...t,
    variants: t.variants ? [...t.variants] : [],
    suitePath: t.suitePath ? [...t.suitePath] : undefined,
  }));
}

/**
 * Clear all registered tests.
 */
export function clearRegisteredTests(): void {
  const reg = getRegistry();
  reg.tests = [];
  reg.suiteStack = [];
  reg.beforeEachHooks = [];
  reg.afterEachHooks = [];
}

/**
 * Register a hook to run before each test.
 */
export function beforeEach(fn: HookFn): void {
  const reg = getRegistry();
  reg.beforeEachHooks.push({
    fn,
    suitePath: [...reg.suiteStack],
  });
}

/**
 * Register a hook to run after each test.
 */
export function afterEach(fn: HookFn): void {
  const reg = getRegistry();
  reg.afterEachHooks.push({
    fn,
    suitePath: [...reg.suiteStack],
  });
}

export function getRegisteredBeforeEachHooks(): HookDefinition[] {
  const reg = getRegistry();
  return reg.beforeEachHooks.map((h) => ({
    ...h,
    suitePath: [...h.suitePath],
  }));
}

export function getRegisteredAfterEachHooks(): HookDefinition[] {
  const reg = getRegistry();
  return reg.afterEachHooks.map((h) => ({
    ...h,
    suitePath: [...h.suitePath],
  }));
}

/**
 * Filter hooks that apply to the given suite path.
 */
export function getMatchingHooks(hooks: HookDefinition[], suitePath?: string[]): HookDefinition[] {
  return hooks.filter((h) => {
    if (h.suitePath.length === 0) return true;
    if (!suitePath || h.suitePath.length > suitePath.length) return false;
    return h.suitePath.every((p, i) => p === suitePath[i]);
  });
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
export {
  defineConfig,
  assertValidPlugins,
  loadConfig,
  validateRunnerNames,
} from "./core/config.js";
export {
  DefaultReporter,
  SilentReporter,
  VerboseReporter,
  CIReporter,
  Spinner,
  LivePanel,
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

// ─── Plugin interfaces & implementations ───

export type {
  IModelPlugin,
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
