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
   * Use {{prompt}} as placeholder for the judge prompt.
   * The command must output JSON: { "pass": boolean, "score": number, "reason": string }
   */
  command?: string;
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
  /** Whether the test passed the judge evaluation */
  pass: boolean;
  /** Score from 0.0 to 1.0 */
  score: number;
  /** Markdown-formatted reason / explanation */
  reason: string;
}

export interface JudgeOptions {
  /** Evaluation criteria (Markdown) */
  criteria: string;
  /** Optional model override for this specific judgment */
  model?: string;
}

// ─── Ledger Entry ───

export interface LedgerEntry {
  /** Unique test identifier */
  testId: string;
  /** ISO timestamp */
  timestamp: string;
  /** Agent model / runner name */
  agentRunner: string;
  /** Judge model used */
  judgeModel: string;
  /** Score from 0.0 to 1.0 */
  score: number;
  /** Pass / fail */
  pass: boolean;
  /** Judge's markdown reason */
  reason: string;
  /** Raw context: diff + command logs */
  context: {
    diff: string | null;
    commands: CommandResult[];
  };
  /** Duration of the agent run in ms */
  durationMs: number;
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
}

// ─── Expect ───

export interface ExpectChain {
  toPassJudge(options: JudgeOptions): Promise<JudgeResult>;
}
