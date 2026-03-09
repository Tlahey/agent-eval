/**
 * Plugin interfaces for the AgentEval SOLID architecture.
 *
 * All follow the Dependency Inversion Principle (DIP):
 * high-level modules (Runner, CLI) depend on abstractions, not concrete implementations.
 */

import type {
  LedgerEntry,
  ScoreOverride,
  TestContext,
  JudgeResult,
  JudgeConfig,
  TokenUsage,
} from "./types.js";

// ─── Model Plugin ───

export interface ModelSettings {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  maxSteps?: number;
}

export interface IModelPlugin {
  readonly name: string;
  readonly modelId: string;
  readonly settings?: ModelSettings;
  readonly tools?: Record<string, unknown>;
  createModel(): unknown | Promise<unknown>;
}

// ─── CLI Execution Model ───

export interface CliOutputMetrics {
  tokenUsage?: TokenUsage;
  agentOutput?: string;
}

export type CliOutputParser = (output: { stdout: string; stderr: string }) => CliOutputMetrics;

export interface ICliModel {
  readonly type: "cli";
  readonly name: string;
  readonly command: string;
  parseOutput?: CliOutputParser;
}

export function isCliModel(model: IModelPlugin | ICliModel): model is ICliModel {
  return "type" in model && (model as ICliModel).type === "cli";
}

// ─── Runner Execution Context ───

export interface RunnerContext {
  cwd: string;
  env: IEnvironmentPlugin;
  timeout?: number;
}

export interface RunnerExecResult {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  filesWritten?: string[];
  tokenUsage?: import("./types.js").TokenUsage;
  output?: string;
}

// ─── Ledger Plugin ───

export interface RunnerStats {
  agentRunner: string;
  avgScore: number;
  totalRuns: number;
  passRate: number;
}

export interface TestTreeNode {
  name: string;
  type: "suite" | "test";
  testId?: string;
  children?: TestTreeNode[];
}

export interface ILedgerPlugin {
  readonly name: string;
  initialize(): void | Promise<void>;
  recordRun(entry: LedgerEntry): void | Promise<void>;
  getRuns(testId?: string): LedgerEntry[] | Promise<LedgerEntry[]>;
  getRunById(id: number): LedgerEntry | undefined | Promise<LedgerEntry | undefined>;
  getTestIds(): string[] | Promise<string[]>;
  getTags(): string[] | Promise<string[]>;
  getTestTree(): TestTreeNode[] | Promise<TestTreeNode[]>;
  getLatestEntries(): Map<string, LedgerEntry> | Promise<Map<string, LedgerEntry>>;
  getStats(testId?: string): RunnerStats[] | Promise<RunnerStats[]>;
  overrideRunScore(
    runId: number,
    score: number,
    reason: string,
  ): ScoreOverride | Promise<ScoreOverride>;
  getRunOverrides(runId: number): ScoreOverride[] | Promise<ScoreOverride[]>;
  close?(): void | Promise<void>;
}

// ─── Judge Plugin ───

export interface IJudgePlugin {
  readonly name: string;
  judge(
    ctx: TestContext,
    criteria: string,
    config: JudgeConfig,
    options?: { model?: string; expectedFiles?: string[] },
  ): Promise<JudgeResult>;
}

// ─── Environment Plugin ───

export interface EnvironmentExecOptions {
  timeout?: number;
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
}

export interface EnvironmentCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface IEnvironmentPlugin {
  readonly name: string;
  readonly supportsConcurrency: boolean;

  setup(cwd: string): void | Promise<void>;

  prepareRun?(
    cwd: string,
    runId: string,
  ): Promise<{ workingDir: string; cleanup?: () => Promise<void> }>;

  execute(
    command: string,
    cwd: string,
    options?: EnvironmentExecOptions,
  ): EnvironmentCommandResult | Promise<EnvironmentCommandResult>;

  getDiff(cwd: string): string | Promise<string>;

  teardownRun?(cwd: string, workingDir: string): void | Promise<void>;

  teardown?(cwd: string): void | Promise<void>;
}
