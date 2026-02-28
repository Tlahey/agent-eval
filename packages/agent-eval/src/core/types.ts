// ─── Agent Configuration ───

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
  /** Type of judge: API call (default) or CLI command */
  type?: "api" | "cli";
  /** Provider for API judges */
  provider?: "anthropic" | "openai" | "ollama";
  /** Model name for API judges */
  model?: string;
  baseURL?: string;
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
  /** Agent runners to test against */
  runners: AgentRunnerConfig[];
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
   * LLM plugins for judge evaluation and API runners.
   * When provided, these are used instead of the built-in Vercel AI SDK integrations.
   *
   * @example
   * ```ts
   * import { AnthropicLLM } from "agent-eval";
   * export default defineConfig({
   *   llm: new AnthropicLLM({ model: "claude-sonnet-4-20250514" }),
   *   // ...
   * });
   * ```
   */
  llm?: import("./interfaces.js").ILLMPlugin;
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

export interface TestContext {
  /** Store the current git diff into context */
  storeDiff(): void;
  /** Run a shell command and store its output in context */
  runCommand(name: string, command: string): Promise<CommandResult>;
  /** Get the stored git diff */
  readonly diff: string | null;
  /** Get all stored command results */
  readonly commands: CommandResult[];
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
  /** Execute the agent with a prompt instruction */
  run(prompt: string): Promise<void>;
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

export type TestFn = (args: TestFnArgs) => Promise<void>;

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
