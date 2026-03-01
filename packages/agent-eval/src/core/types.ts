// ─── Agent Configuration ───

/**
 * @deprecated Use IRunnerPlugin instances directly in `runners[]`.
 * Kept temporarily for backward compatibility during migration.
 */
export interface AgentRunnerConfig {
  /** Unique name for the agent (e.g., "copilot", "cursor") */
  name: string;
  /** Type of runner: CLI command or API call */
  type: "cli" | "api";
  /** CLI command template. Use {{prompt}} as placeholder for the instruction. */
  command?: string;
  /** API configuration for direct model calls */
  api?: {
    provider: "anthropic" | "openai" | "ollama";
    model: string;
    baseURL?: string;
    apiKey?: string;
  };
}

// ─── Judge Configuration ───

export interface JudgeConfig {
  /**
   * LLM plugin for API-based judging.
   * When provided, `type`, `provider`, `model`, `apiKey`, `baseURL` are ignored.
   *
   * @example
   * ```ts
   * import { OpenAIModel } from "agent-eval";
   * judge: { llm: new OpenAIModel({ model: "gpt-4o" }) }
   * ```
   */
  llm?: import("./interfaces.js").IModelPlugin;
  /** @deprecated Use `llm` with an IModelPlugin instead. Type of judge: API call (default) or CLI command */
  type?: "api" | "cli";
  /** @deprecated Use `llm` with an IModelPlugin instead. */
  provider?: "anthropic" | "openai" | "ollama";
  /** @deprecated Use `llm` with an IModelPlugin instead. */
  model?: string;
  /** @deprecated Use `llm` with an IModelPlugin instead. */
  baseURL?: string;
  /** @deprecated Use `llm` with an IModelPlugin instead. */
  apiKey?: string;
  /**
   * CLI command template for CLI judges.
   * Use {{prompt}} as placeholder for the judge prompt,
   * or {{prompt_file}} for a temp file containing the prompt.
   * The command must output JSON: { "pass": boolean, "score": number, "reason": string }
   */
  command?: string;
  /**
   * Number of retry attempts if the CLI judge returns invalid JSON.
   * Each retry re-executes the command. Defaults to 2.
   */
  maxRetries?: number;
}

// ─── Status & Thresholds ───

/** Test result status based on score thresholds */
export type TestStatus = "PASS" | "WARN" | "FAIL";

/** Score thresholds for determining test status */
export interface Thresholds {
  /** Minimum score for PASS status (default: 0.8) */
  warn: number;
  /** Minimum score for WARN status; below this is FAIL (default: 0.5) */
  fail: number;
}

/** Default thresholds used when none are specified */
export const DEFAULT_THRESHOLDS: Thresholds = { warn: 0.8, fail: 0.5 };

/**
 * Compute the test status from a score and thresholds.
 */
export function computeStatus(
  score: number,
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): TestStatus {
  if (score >= thresholds.warn) return "PASS";
  if (score >= thresholds.fail) return "WARN";
  return "FAIL";
}

// ─── Main Configuration ───

export interface AgentEvalConfig {
  /** Root directory of the project (defaults to cwd) */
  rootDir?: string;
  /** Glob pattern(s) to discover test files */
  testFiles?: string | string[];
  /**
   * Agent runners to test against.
   * Each runner is an IRunnerPlugin instance (CLIRunner, APIRunner, or custom).
   *
   * @example
   * ```ts
   * import { CLIRunner, APIRunner, AnthropicModel } from "agent-eval";
   * runners: [
   *   new CLIRunner({ name: "copilot", command: "gh copilot suggest {{prompt}}" }),
   *   new APIRunner({ name: "claude", model: new AnthropicModel({ model: "claude-sonnet-4-20250514" }) }),
   * ]
   * ```
   */
  runners: import("./interfaces.js").IRunnerPlugin[];
  /** Judge configuration for LLM-as-a-Judge evaluation */
  judge: JudgeConfig;
  /** Model matrix: override which models to test per-run */
  matrix?: {
    runners?: string[];
  };
  /** Ledger output directory (defaults to .agenteval) */
  outputDir?: string;
  /** Timeout in ms for each agent run (defaults to 300_000 = 5 min) */
  timeout?: number;
  /**
   * Commands to run automatically after each agent execution.
   * These run before the expect/judge phase, after storeDiff.
   * Example: [{ name: "test", command: "pnpm test" }, { name: "typecheck", command: "pnpm build" }]
   */
  afterEach?: AfterEachCommand[];
  /**
   * Hook function called before each test iteration.
   * Use this to register common verification tasks via `ctx.addTask()`.
   * Config-level beforeEach runs before any DSL-level beforeEach hooks.
   *
   * @example
   * ```ts
   * export default defineConfig({
   *   beforeEach: ({ ctx }) => {
   *     ctx.addTask({
   *       name: "Tests",
   *       action: () => ctx.exec("pnpm test"),
   *       criteria: "All tests must pass",
   *       weight: 3,
   *     });
   *   },
   * });
   * ```
   */
  beforeEach?: (args: { ctx: TestContext }) => void | Promise<void>;
  /**
   * Global scoring thresholds for determining test status (PASS / WARN / FAIL).
   * Can be overridden per-test via JudgeOptions.thresholds.
   * Defaults to { warn: 0.8, fail: 0.5 }.
   */
  thresholds?: Thresholds;
  /**
   * Ledger plugin instance for result storage.
   * If not provided, defaults to the built-in SQLite ledger.
   *
   * @example
   * ```ts
   * import { SqliteLedger } from "agent-eval";
   * export default defineConfig({
   *   ledger: new SqliteLedger({ outputDir: ".agenteval" }),
   *   // ...
   * });
   * ```
   */
  ledger?: import("./interfaces.js").ILedgerPlugin;
  /**
   * Execution environment plugin (local Git, Docker, SSH, etc.).
   * Controls workspace setup/teardown, command execution, and diff collection.
   * If not provided, defaults to LocalEnvironment (Git isolation + child_process).
   *
   * @example
   * ```ts
   * import { DockerEnvironment } from "agent-eval";
   * export default defineConfig({
   *   environment: new DockerEnvironment({ image: "node:22" }),
   *   // ...
   * });
   * ```
   */
  environment?: import("./interfaces.js").IEnvironmentPlugin;
}

export interface AfterEachCommand {
  /** Human-readable name for the command (used in logs and judge prompt) */
  name: string;
  /** Shell command to execute */
  command: string;
}

// ─── Test Context ───

export interface CommandResult {
  name: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

/**
 * A task registered via `ctx.addTask()` in declarative pipeline mode.
 * Tasks execute after the agent instruction and are evaluated by the judge.
 */
export interface TaskDefinition {
  /** Human-readable name for the task (used in logs and judge prompt) */
  name: string;
  /** Action to execute after the agent runs. Returns a CommandResult for the judge. */
  action: () => CommandResult | Promise<CommandResult>;
  /** Evaluation criteria for the judge to assess this task's outcome */
  criteria: string;
  /** Weight for scoring (default: 1). Higher weight = more impact on final score. */
  weight?: number;
}

export interface TestContext {
  /** Store the current git diff into context */
  storeDiff(): void;
  /** Run a shell command and store its output in context */
  runCommand(name: string, command: string): Promise<CommandResult>;
  /**
   * Register a task for post-agent execution (declarative pipeline).
   * Tasks are executed by the runner after the agent instruction completes.
   * Each task's criteria and result are sent to the judge for evaluation.
   */
  addTask(task: TaskDefinition): void;
  /**
   * Execute a shell command and return the result.
   * Convenience wrapper for use inside task actions.
   *
   * @example
   * ```ts
   * ctx.addTask({
   *   name: "Build",
   *   action: () => ctx.exec("pnpm run build"),
   *   criteria: "the build must succeed",
   * });
   * ```
   */
  exec(command: string): Promise<CommandResult>;
  /** Get the stored git diff */
  readonly diff: string | null;
  /** Get all stored command results */
  readonly commands: CommandResult[];
  /** Get all registered tasks (declarative pipeline) */
  readonly tasks: ReadonlyArray<TaskDefinition>;
  /** Get all logs as a formatted string */
  readonly logs: string;
}

// ─── Judge Result ───

export interface JudgeResult {
  /** Whether the test passed the judge evaluation (PASS or WARN = true, FAIL = false) */
  pass: boolean;
  /** Rich status: PASS, WARN, or FAIL — computed by the runner using thresholds */
  status?: TestStatus;
  /** Score from 0.0 to 1.0 */
  score: number;
  /** Markdown-formatted reason / explanation */
  reason: string;
  /** Markdown-formatted suggestions to improve the score */
  improvement: string;
}

export interface JudgeOptions {
  /** Evaluation criteria (Markdown) */
  criteria: string;
  /** Optional model override for this specific judgment */
  model?: string;
  /**
   * Expected files that should be modified by the agent.
   * The judge will verify these files were changed and flag
   * unexpected modifications as potential scope creep.
   */
  expectedFiles?: string[];
  /**
   * Per-test scoring thresholds. Overrides global config thresholds.
   * Defaults to { warn: 0.8, fail: 0.5 }.
   */
  thresholds?: Thresholds;
}

// ─── Ledger Entry ───

export interface LedgerEntry {
  /** Database row ID (set when reading from DB, absent when creating) */
  id?: number;
  /** Unique test identifier */
  testId: string;
  /** Suite path from nested describe() blocks (e.g., ["UI Components", "Banner"]) */
  suitePath: string[];
  /** ISO timestamp */
  timestamp: string;
  /** Agent model / runner name */
  agentRunner: string;
  /** Judge model used */
  judgeModel: string;
  /** Score from 0.0 to 1.0 */
  score: number;
  /** Pass / fail (PASS or WARN = true, FAIL = false) */
  pass: boolean;
  /** Rich status: PASS, WARN, or FAIL */
  status: TestStatus;
  /** Judge's markdown reason */
  reason: string;
  /** Judge's markdown improvement suggestions */
  improvement: string;
  /** Raw context: diff + command logs */
  context: {
    diff: string | null;
    commands: CommandResult[];
  };
  /** Duration of the agent run in ms */
  durationMs: number;
  /** Thresholds used for this run (preserved for historical accuracy) */
  thresholds: Thresholds;
  /** Human override (if any). Present only when reading from DB. */
  override?: ScoreOverride;
}

/** A human-in-the-loop score override for a run. */
export interface ScoreOverride {
  /** The manually assigned score (0.0 – 1.0) */
  score: number;
  /** Updated pass/fail based on the overridden score */
  pass: boolean;
  /** Rich status: PASS, WARN, or FAIL */
  status: TestStatus;
  /** Human-provided reason for the override */
  reason: string;
  /** ISO timestamp of when the override was applied */
  timestamp: string;
}

// ─── Test Definition ───

export interface AgentHandle {
  /** Execute the agent with a prompt instruction (imperative mode) */
  run(prompt: string): Promise<void>;
  /**
   * Register a prompt for declarative execution (Single-Instruct Policy).
   * The runner will execute this instruction after the test function returns.
   * Only ONE instruct() call is allowed per test — calling it twice throws an error.
   */
  instruct(prompt: string): void;
  /** The name of the current runner */
  readonly name: string;
  /** The model being used */
  readonly model: string;
}

export interface TestFnArgs {
  agent: AgentHandle;
  ctx: TestContext;
  judge: JudgeConfig;
}

export type TestFn = (args: TestFnArgs) => void | Promise<void>;

export interface TestDefinition {
  title: string;
  fn: TestFn;
  /** Optional tags for filtering */
  tags?: string[];
  /** Suite path from nested describe() blocks (e.g., ["UI Components", "Banner"]) */
  suitePath?: string[];
}

// ─── Expect ───

export interface ExpectChain {
  toPassJudge(options: JudgeOptions): Promise<JudgeResult>;
}

// ─── Hooks ───

/** Context passed to beforeEach/afterEach hook functions */
export interface HookContext {
  ctx: TestContext;
}

/** A lifecycle hook function (beforeEach / afterEach) */
export type HookFn = (args: HookContext) => void | Promise<void>;

/** Internal hook definition with suite scope */
export interface HookDefinition {
  fn: HookFn;
  suitePath: string[];
}
