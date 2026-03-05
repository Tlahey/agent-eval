// ─── Judge Configuration ───

export interface JudgeConfig {
  /**
   * Human-readable name for the judge (e.g., "gpt-4o-judge", "claude-judge").
   * Used for identification in logs and the dashboard.
   */
  name?: string;
  /**
   * LLM used for evaluation. Accepts any model plugin (API) or CLI model.
   * Same `LlmConfig` type used by `RunnerConfig.model`.
   *
   * - **IModelPlugin**: Uses `generateObject()` with Zod schema for guaranteed structured output.
   * - **ICliModel**: Executes the CLI command with the judge prompt as `{{prompt}}`,
   *   expects JSON output matching `{ pass, score, reason, improvement }`.
   *
   * @example
   * ```ts
   * import { OpenAIModel, CliModel } from "agent-eval/llm";
   *
   * // API model (recommended — structured output guaranteed)
   * judge: { name: "gpt-4o", model: new OpenAIModel({ model: "gpt-4o" }) }
   *
   * // CLI model (parses JSON from stdout)
   * judge: { name: "claude-cli", model: new CliModel({ command: 'claude -p "{{prompt}}" --output-format json' }) }
   * ```
   */
  model?: LlmConfig;
  /**
   * Maximum retry attempts if the judge LLM returns an invalid or unparseable response.
   * The judge **must** return valid structured data — retries ensure reliability.
   * Defaults to 2.
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

// ─── LLM Configuration ───

/**
 * Unified model type for both runners and the judge.
 * Accepts either an API model plugin or a CLI execution model.
 *
 * - **IModelPlugin**: LLM API call via Vercel AI SDK (e.g., AnthropicModel, OpenAIModel)
 * - **ICliModel**: Shell command with `{{prompt}}` placeholder (e.g., CliModel)
 */
export type LlmConfig =
  | import("./interfaces.js").IModelPlugin
  | import("./interfaces.js").ICliModel;

// ─── Runner Configuration ───

/**
 * A runner is a plain object with a name and a model.
 * The model determines HOW to execute:
 *   - IModelPlugin → API call via Vercel AI SDK (generateObject)
 *   - ICliModel → shell command with {{prompt}} placeholder
 *
 * @example
 * ```ts
 * import { AnthropicModel, CliModel } from "agent-eval/llm";
 *
 * const runners: RunnerConfig[] = [
 *   { name: "claude-sonnet", model: new AnthropicModel({ model: "claude-sonnet-4-20250514" }) },
 *   { name: "aider", model: new CliModel({ command: 'aider --message "{{prompt}}" --yes' }) },
 * ];
 * ```
 */
export interface RunnerConfig {
  /** Unique name for the runner (e.g., "claude-sonnet", "gpt-4o", "aider") */
  name: string;
  /** Model or CLI execution model */
  model: LlmConfig;
}

// ─── Main Configuration ───

export interface AgentEvalConfig {
  /** Root directory of the project (defaults to cwd) */
  rootDir?: string;
  /** Glob pattern(s) to discover test files */
  testFiles?: string | string[];
  /**
   * Agent runners to test against. Each runner is a plain object `{ name, model }`.
   * The model determines the execution strategy (API or CLI).
   *
   * @example
   * ```ts
   * import { AnthropicModel, CliModel, OpenAIModel } from "agent-eval/llm";
   *
   * runners: [
   *   { name: "claude", model: new AnthropicModel({ model: "claude-sonnet-4-20250514" }) },
   *   { name: "gpt-4o", model: new OpenAIModel({ model: "gpt-4o" }) },
   *   { name: "aider", model: new CliModel({ command: 'aider --message "{{prompt}}" --yes' }) },
   * ]
   * ```
   */
  runners: RunnerConfig[];
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
   *       action: ({ exec }) => exec("pnpm test"),
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
   * import { SqliteLedger } from "agent-eval/ledger";
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
   * import { DockerEnvironment } from "agent-eval/environment";
   * export default defineConfig({
   *   environment: new DockerEnvironment({ image: "node:22" }),
   *   // ...
   * });
   * ```
   */
  environment?: import("./interfaces.js").IEnvironmentPlugin;
}

// ─── Token Usage ───

/** Token usage from an LLM call (agent or judge) */
export interface TokenUsage {
  /** Number of input/prompt tokens consumed */
  inputTokens: number;
  /** Number of output/completion tokens generated */
  outputTokens: number;
  /** Total tokens (input + output). May differ from sum if provider counts differently. */
  totalTokens: number;
}

// ─── Task Result ───

/** A task definition paired with its execution result */
export interface TaskResult {
  task: TaskDefinition;
  result: CommandResult;
}

// ─── Execution Data (what the agent did) ───

/** Timing breakdown per phase of a test execution */
export interface TimingData {
  /** Total wall-clock time for the entire test iteration (ms) */
  totalMs: number;
  /** Time spent in environment setup — git reset, docker create (ms) */
  setupMs?: number;
  /** Time spent executing the agent instruction (ms) */
  agentMs?: number;
  /** Time spent executing registered tasks (ms) */
  tasksMs?: number;
  /** Time spent on judge evaluation (ms) */
  judgeMs?: number;
}

/**
 * All data collected during the agent execution phase.
 * This is the single source of truth passed to the judge for evaluation.
 */
export interface ExecutionData {
  /** The instruction/prompt given to the agent */
  instruction: string;
  /** Runner metadata */
  runner: { name: string; model: string };
  /** Git diff captured after agent execution */
  diff: string | null;
  /** Files changed (extracted from diff) */
  changedFiles: string[];
  /** All command results (runCommand + task actions) */
  commands: CommandResult[];
  /** Task definitions paired with their execution results */
  taskResults: TaskResult[];
  /** Token usage from the agent's LLM call (if available, API runners only) */
  tokenUsage?: TokenUsage;
  /** Per-phase timing breakdown */
  timing: TimingData;
  /** Raw agent output (stdout for CLI runners, LLM response for API runners) */
  agentOutput?: string;
  /** Formatted logs (diff + command outputs as readable text) */
  logs: string;
  /** Optional file tree or file list of the project */
  projectStructure?: string;
  /** Optional content of project-level instructions (e.g. AGENTS.md) */
  projectInstructions?: string;
}

// ─── Judgment Data (how the judge evaluated) ───

/**
 * All data from the judge evaluation phase.
 */
export interface JudgmentData {
  /** Judge model identifier */
  model: string;
  /** Score from 0.0 to 1.0 */
  score: number;
  /** Whether the test passed (PASS or WARN = true, FAIL = false) */
  pass: boolean;
  /** Rich status: PASS, WARN, or FAIL */
  status: TestStatus;
  /** Markdown-formatted evaluation explanation */
  reason: string;
  /** Markdown-formatted improvement suggestions */
  improvement: string;
  /** Token usage from the judge's LLM call (if available) */
  tokenUsage?: TokenUsage;
  /** Evaluation criteria used by the judge */
  criteria: string;
  /** Expected files (for scope analysis) */
  expectedFiles?: string[];
  /** Scoring thresholds used for this evaluation */
  thresholds: Thresholds;
}

// ─── Run Report ───

/**
 * Unified report for a single test × runner execution.
 * Contains ALL data from both the execution and judgment phases.
 * This is the canonical structure stored in the ledger.
 */
export interface RunReport {
  /** Everything about what the agent did */
  execution: ExecutionData;
  /** Everything about how the judge evaluated the result */
  judgment: JudgmentData;
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
 * Minimal result from a task action. The runner enriches this into a full CommandResult.
 */
export interface TaskActionResult {
  stdout: string;
  stderr?: string;
  exitCode: number;
  /** Optional: filled automatically by ctx.exec() */
  name?: string;
  /** Optional: filled automatically by ctx.exec() */
  command?: string;
  /** Optional: filled automatically by ctx.exec() */
  durationMs?: number;
}

/**
 * Utility passed to task actions to execute shell commands.
 */
export interface TaskUtils {
  /**
   * Execute a shell command and return the result.
   */
  exec(command: string): Promise<CommandResult>;
}

/**
 * A task registered via `ctx.addTask()` in declarative pipeline mode.
 * Tasks execute after the agent instruction and are evaluated by the judge.
 */
export interface TaskDefinition {
  /** Human-readable name for the task (used in logs and judge prompt) */
  name: string;
  /** Action to execute after the agent runs. Returns a result for the judge. */
  action: (utils: TaskUtils) => TaskActionResult | Promise<TaskActionResult>;
  /** Evaluation criteria for the judge to assess this task's outcome */
  criteria: string;
  /** Weight for scoring (default: 1). Higher weight = more impact on final score. */
  weight?: number;
}

export interface TestContext {
  /** Store the current git diff into context */
  storeDiff(): void;
  /**
   * Register a task for post-agent execution (declarative pipeline).
   * Tasks are executed by the runner after the agent instruction completes.
   * Each task's criteria and result are sent to the judge for evaluation.
   */
  addTask(task: TaskDefinition): void;
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

  // ─── Execution data (what the agent did) ───

  /** Agent model / runner name */
  agentRunner: string;
  /** The instruction given to the agent */
  instruction?: string;
  /** Git diff captured after execution */
  diff: string | null;
  /** Files changed (extracted from diff) */
  changedFiles: string[];
  /** All command results */
  commands: CommandResult[];
  /** Task definitions paired with their results */
  taskResults: TaskResult[];
  /** Token usage from the agent's LLM call */
  agentTokenUsage?: TokenUsage;
  /** Per-phase timing breakdown */
  timing: TimingData;
  /** Raw agent output (stdout for CLI, response for API) */
  agentOutput?: string;
  /** Formatted logs */
  logs: string;

  // ─── Judgment data (how the judge evaluated) ───

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
  /** Token usage from the judge's LLM call */
  judgeTokenUsage?: TokenUsage;
  /** Evaluation criteria used */
  criteria: string;
  /** Expected files for scope analysis */
  expectedFiles?: string[];
  /** Thresholds used for this run (preserved for historical accuracy) */
  thresholds: Thresholds;

  /** Duration of the agent run in ms (alias for timing.totalMs, kept for backward compat) */
  durationMs: number;

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
