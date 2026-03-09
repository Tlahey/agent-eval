// ─── Judge Configuration ───

export interface JudgeConfig {
  name?: string;
  model?: LlmConfig;
  maxRetries?: number;
}

// ─── Status & Thresholds ───

export type TestStatus = "PASS" | "WARN" | "FAIL";

export interface Thresholds {
  warn: number;
  fail: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = { warn: 0.8, fail: 0.5 };

export function computeStatus(
  score: number,
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): TestStatus {
  if (score >= thresholds.warn) return "PASS";
  if (score >= thresholds.fail) return "WARN";
  return "FAIL";
}

// ─── LLM Configuration ───

export type LlmConfig =
  | import("./interfaces.js").IModelPlugin
  | import("./interfaces.js").ICliModel;

// ─── Runner Configuration ───

export interface RunnerConfig {
  id: string;
  model: LlmConfig;
}

// ─── Variants & Experiments ───

export interface TestVariant {
  id: string;
  name: string;
  runnerId: string;
  enrichPrompt?: string;
  skills?: string[];
  metadata?: Record<string, any>;
}

// ─── Main Configuration ───

export interface AgentEvalConfig {
  rootDir?: string;
  testFiles?: string | string[];
  runners: RunnerConfig[];
  defaultRunner?: string;
  judge: JudgeConfig;
  matrix?: {
    runners?: string[];
  };
  outputDir?: string;
  timeout?: number;
  beforeEach?: (args: { ctx: TestContext }) => void | Promise<void>;
  thresholds?: Thresholds;
  ledger?: import("./interfaces.js").ILedgerPlugin;
  environment?: import("./interfaces.js").IEnvironmentPlugin;
}

// ─── Data Structures ───

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
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
  tokenUsage?: TokenUsage;
  timing: TimingData;
  agentOutput?: string;
  logs: string;
}

export interface JudgmentData {
  model: string;
  score: number;
  pass: boolean;
  status: TestStatus;
  reason: string;
  improvement: string;
  tokenUsage?: TokenUsage;
  criteria: string;
  expectedFiles?: string[];
  thresholds: Thresholds;
}

export interface RunReport {
  execution: ExecutionData;
  judgment: JudgmentData;
}

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

export interface TestContext {
  readonly cwd: string;
  /** Define the agent mission (prompt) */
  prompt(text: string): void;
  storeDiff(): void;
  addTask(task: TaskDefinition): void;
  runCommand(name: string, command: string): Promise<CommandResult>;
  setRunnerInfo(info: { id: string; model: string }): void;
  setInstruction(instruction: string): void;
  readonly diff: string | null;
  readonly commands: CommandResult[];
  readonly tasks: ReadonlyArray<TaskDefinition>;
  readonly logs: string;
}

export interface JudgeResult {
  pass: boolean;
  status?: TestStatus;
  score: number;
  reason: string;
  improvement: string;
}

export interface JudgeOptions {
  criteria: string;
  expectedFiles?: string[];
  thresholds?: Thresholds;
}

export interface LedgerEntry {
  id?: number;
  testId: string;
  tags?: string[];
  suitePath: string[];
  timestamp: string;
  variantId?: string;
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
  thresholds: Thresholds;
  durationMs: number;
  override?: ScoreOverride;
}

export interface ScoreOverride {
  score: number;
  pass: boolean;
  status: TestStatus;
  reason: string;
  timestamp: string;
}

// ─── Test Handle ───

export interface AgentHandle {
  readonly id: string;
  readonly model: string;
  readonly variant?: {
    id: string;
    name: string;
    metadata?: Record<string, any>;
  };
  /** @deprecated Define mission via ctx.prompt() instead */
  run(prompt: string): Promise<void>;
  /** @deprecated Define mission via ctx.prompt() instead */
  instruct(prompt: string): void;
}

export interface TestFnArgs {
  agent: AgentHandle;
  ctx: TestContext;
  judge: JudgeConfig;
  variant?: TestVariant;
}

export type TestFn = (args: TestFnArgs) => void | Promise<void>;

export interface TestDefinition {
  title: string;
  fn: TestFn;
  tags?: string[];
  suitePath?: string[];
  variants?: TestVariant[];
}

export interface ExpectChain {
  toPassJudge(options: JudgeOptions): Promise<JudgeResult>;
}

export interface HookContext {
  ctx: TestContext;
}

export type HookFn = (args: HookContext) => void | Promise<void>;

export interface HookDefinition {
  fn: HookFn;
  suitePath: string[];
}
