import { setJudgeConfig, setGlobalThresholds } from "./core/expect.js";
import type { AgentEvalConfig, TestDefinition, TestFn } from "./core/types.js";
import { DEFAULT_THRESHOLDS } from "./core/types.js";

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
  setGlobalThresholds(config.thresholds ?? DEFAULT_THRESHOLDS);
}

// ─── Re-exports ───

export { expect } from "./core/expect.js";
export { defineConfig, assertValidPlugins } from "./core/config.js";
export { DefaultReporter, SilentReporter, VerboseReporter } from "./core/reporter.js";
export type { Reporter, TestEvent, TestResultEvent } from "./core/reporter.js";
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
} from "./core/types.js";
export { DEFAULT_THRESHOLDS, computeStatus } from "./core/types.js";

// ─── Plugin interfaces & implementations ───

export type {
  ILedgerPlugin,
  ILLMPlugin,
  IJudgePlugin,
  IEnvironmentPlugin,
  EnvironmentCommandResult,
  RunnerStats,
  TestTreeNode,
} from "./core/interfaces.js";

export { SqliteLedger } from "./ledger/sqlite-plugin.js";
export { JsonLedger } from "./ledger/json-plugin.js";
export { BaseLLMPlugin } from "./llm/base-plugin.js";
export { AnthropicLLM } from "./llm/anthropic-plugin.js";
export { OpenAILLM } from "./llm/openai-plugin.js";
export { OllamaLLM } from "./llm/ollama-plugin.js";
export { LocalEnvironment } from "./environment/local-environment.js";
export { DockerEnvironment } from "./environment/docker-environment.js";
export type { DockerEnvironmentOptions } from "./environment/docker-environment.js";
export {
  validatePlugins,
  validateLedgerPlugin,
  validateLLMPlugin,
  validateJudgePlugin,
  validateEnvironmentPlugin,
  formatPluginErrors,
} from "./core/plugin-validator.js";
export type { PluginValidationError } from "./core/plugin-validator.js";
