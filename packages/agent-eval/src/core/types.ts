/**
 * Logic for computing test status from a judge score.
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

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ModelSettings {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  maxSteps?: number;
}

export interface LlmConfig {
  readonly name: string;
  readonly modelId: string;
  readonly settings?: ModelSettings;
  readonly tools?: Record<string, unknown>;
  createModel(): unknown | Promise<unknown>;
}

export interface RunnerConfig {
  id: string;
  model: LlmConfig | import("./interfaces.js").ICliModel;
}

// ─── Variants & Experiments ───

export interface TestVariant<TRunnerId extends string = string> {
  /** Display name for the UI and identification */
  name: string;
  /** The runner to use for this specific variant (must match config.runners) */
  runner: TRunnerId;
  /** Optional prompt enrichment template (e.g., "Answer as a {{role}}: {{prompt}}") */
  enrichPrompt?: string;
  /** Custom metadata for reporting/filtering */
  metadata?: Record<string, any>;
}

// ─── Main Configuration ───

export interface Thresholds {
  warn: number;
  fail: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  warn: 0.8,
  fail: 0.5,
};

export interface AgentEvalConfig {
  rootDir?: string;
  testFiles?: string | string[];
  runners: RunnerConfig[];
  judge: JudgeConfig;
  outputDir?: string;
  timeout?: number;
  runs?: number;
  beforeEach?: (args: { ctx: TestContext }) => void | Promise<void>;
  thresholds?: Thresholds;
  ledger?: import("./interfaces.js").ILedgerPlugin;
  environment?: import("./interfaces.js").IEnvironmentPlugin;
}

// ─── Test Context & Execution ───

export interface CommandResult {
  name: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

export interface TaskActionResult {
  stdout: string;
  stderr?: string;
  exitCode: number;
  name?: string;
  command?: string;
  durationMs?: number;
}

export interface TaskUtils {
  exec(command: string): Promise<CommandResult>;
}

export interface TaskDefinition {
  name: string;
  action: (utils: TaskUtils) => TaskActionResult | Promise<TaskActionResult>;
  criteria: string;
  weight?: number;
}

export interface TaskResult {
  task: TaskDefinition;
  result: CommandResult;
}

export interface TimingData {
  totalMs: number;
  setupMs?: number;
  agentMs?: number;
  tasksMs?: number;
  judgeMs?: number;
}

export interface ExecutionData {
  instruction: string;
  runner: { id: string; model: string };
  diff: string | null;
  changedFiles: string[];
  commands: CommandResult[];
  taskResults: TaskResult[];
  agentTokenUsage?: TokenUsage;
  timing: TimingData;
  agentOutput?: string;
  logs: string;
}

export interface JudgmentData {
  score: number;
  reason: string;
  improvement: string;
}

export interface JudgeConfig {
  model: LlmConfig | import("./interfaces.js").ICliModel;
  maxRetries?: number;
}

export interface JudgeResult {
  score: number;
  pass: boolean;
  status: TestStatus;
  reason: string;
  improvement: string;
}

export interface JudgeOptions {
  criteria: string;
  expectedFiles?: string[];
  requiredCommands?: string[];
  thresholds?: Thresholds;
}

export interface LedgerEntry {
  id?: number;
  testId: string;
  tags?: string[];
  suitePath: string[];
  timestamp: string;
  variantName?: string;
  basePrompt?: string;
  agentRunner: string;
  instruction?: string;
  diff: string | null;
  changedFiles: string[];
  commands: CommandResult[];
  taskResults: TaskResult[];
  agentTokenUsage?: TokenUsage;
  timing: TimingData;
  agentOutput?: string;
  logs: string;
  judgeModel: string;
  score: number;
  pass: boolean;
  status: TestStatus;
  reason: string;
  improvement: string;
  judgeTokenUsage?: TokenUsage;
  criteria: string;
  expectedFiles?: string[];
  requiredCommands?: string[];
  thresholds: Thresholds;
  durationMs: number;
  override?: ScoreOverride;
}

export interface ScoreOverride {
  timestamp: string;
  score: number;
  pass: boolean;
  status: TestStatus;
  reason: string;
  author?: string;
}

export type TestStatus = "PASS" | "WARN" | "FAIL";

// ─── Test Definitions ───

export interface AgentHandle {
  readonly id: string;
  readonly model: string;
  readonly variant?: {
    name: string;
    metadata?: Record<string, any>;
  };
  /** @deprecated Define mission via ctx.prompt() instead */
  run(prompt: string): Promise<void>;
  /** @deprecated Define mission via ctx.prompt() instead */
  instruct(prompt: string): void;
}

export interface TestFnArgs<TRunnerId extends string = string> {
  agent: AgentHandle;
  ctx: TestContext;
  judge: JudgeConfig;
  variant: TestVariant<TRunnerId>;
}

export type TestFn<TRunnerId extends string = string> = (
  args: TestFnArgs<TRunnerId>,
) => void | Promise<void>;

export interface TestDefinition<TRunnerId extends string = string> {
  title: string;
  /** Variants are now mandatory (even for a single baseline run) */
  variants: TestVariant<TRunnerId>[];
  fn: TestFn<TRunnerId>;
  tags?: string[];
  suitePath?: string[];
}

export interface ExpectChain {
  toPassJudge(options: JudgeOptions): Promise<JudgeResult>;
}

export interface TestContext {
  readonly cwd: string;
  readonly instruction: string;
  readonly diff: string | null;
  readonly commands: CommandResult[];
  readonly tasks: ReadonlyArray<TaskDefinition>;
  readonly logs: string;
  readonly agentOutput?: string;
  readonly agentTokenUsage?: TokenUsage;

  prompt(text: string): void;
  setInstruction(text: string): void;
  setRunnerInfo(info: { id: string; model: string }): void;
  setAgentOutput(output: string): void;
  setAgentTokenUsage(usage: TokenUsage): void;
  addTask(task: TaskDefinition): void;
  runCommand(name: string, command: string): Promise<CommandResult>;
  storeDiff(): void;
  storeDiffAsync(): Promise<void>;
  buildExecutionData(taskResults: TaskResult[], timing: TimingData): ExecutionData;
}

// ─── Hooks ───

export interface HookContext {
  ctx: TestContext;
}

export type HookFn = (args: HookContext) => void | Promise<void>;

export interface HookDefinition {
  fn: HookFn;
  suitePath: string[];
}

export interface RunReport {
  timestamp: string;
  totalTests: number;
  passed: number;
  failed: number;
  results: LedgerEntry[];
}
