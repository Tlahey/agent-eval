/**
 * Plugin interfaces for the AgentEval SOLID architecture.
 *
 * These interfaces define the contracts for:
 * - ILedgerPlugin: Storage backend (SQLite, JSON, custom)
 * - IEnvironmentPlugin: Execution environment (Local, Docker)
 * - IJudgePlugin: Evaluation judge (API, CLI)
 *
 * Both follow the Dependency Inversion Principle (DIP):
 * high-level modules (Runner, CLI) depend on abstractions, not concrete implementations.
 */

import type { LedgerEntry, ScoreOverride, TestContext, JudgeResult, JudgeConfig } from "./types.js";

// ─── Ledger Plugin ───

/** Aggregate statistics per runner */
export interface RunnerStats {
  agentRunner: string;
  avgScore: number;
  totalRuns: number;
  passRate: number;
}

/** A tree node representing a suite or test in the hierarchy */
export interface TestTreeNode {
  name: string;
  type: "suite" | "test";
  testId?: string;
  children?: TestTreeNode[];
}

/**
 * Contract for all ledger (storage) plugins.
 *
 * Implementations must handle their own initialization (database creation,
 * file creation, etc.) and cleanup. The framework calls `initialize()` once
 * at startup and `close()` when done.
 *
 * @example
 * ```ts
 * import type { ILedgerPlugin } from "agent-eval";
 *
 * class MongoLedger implements ILedgerPlugin {
 *   readonly name = "mongodb";
 *   async initialize() { // connect to MongoDB }
 *   async recordRun(entry) { // insert into collection }
 *   async getRuns() { // query collection }
 *   // ...
 * }
 * ```
 */
export interface ILedgerPlugin {
  /** Human-readable name of the plugin (e.g., "sqlite", "json", "mongodb") */
  readonly name: string;

  /** Initialize the storage backend (create tables, files, connections, etc.) */
  initialize(): void | Promise<void>;

  /** Persist a single evaluation run */
  recordRun(entry: LedgerEntry): void | Promise<void>;

  /** Retrieve all runs, optionally filtered by test ID */
  getRuns(testId?: string): LedgerEntry[] | Promise<LedgerEntry[]>;

  /** Retrieve a single run by its database ID */
  getRunById(id: number): LedgerEntry | undefined | Promise<LedgerEntry | undefined>;

  /** Get unique test IDs */
  getTestIds(): string[] | Promise<string[]>;

  /** Get hierarchical test tree */
  getTestTree(): TestTreeNode[] | Promise<TestTreeNode[]>;

  /** Get latest entry per test */
  getLatestEntries(): Map<string, LedgerEntry> | Promise<Map<string, LedgerEntry>>;

  /** Get aggregate stats per runner, optionally for a specific test */
  getStats(testId?: string): RunnerStats[] | Promise<RunnerStats[]>;

  /** Override a run's score (human-in-the-loop) */
  overrideRunScore(
    runId: number,
    score: number,
    reason: string,
  ): ScoreOverride | Promise<ScoreOverride>;

  /** Get the audit trail of score overrides for a run */
  getRunOverrides(runId: number): ScoreOverride[] | Promise<ScoreOverride[]>;

  /** Clean up resources (close DB connections, flush buffers, etc.) */
  close?(): void | Promise<void>;
}

// ─── Judge Plugin ───

/**
 * Contract for judge implementations.
 * The default implementation uses the configured judge type (API/CLI),
 * but custom judges (CLI-based, rule-based, etc.) can implement this directly.
 */
export interface IJudgePlugin {
  /** Human-readable name */
  readonly name: string;

  /**
   * Judge the agent's output given a test context and criteria.
   *
   * @param ctx - The test context with diff and command outputs
   * @param criteria - Markdown evaluation criteria
   * @param config - Judge configuration
   * @param options - Additional options (model override, expected files)
   */
  judge(
    ctx: TestContext,
    criteria: string,
    config: JudgeConfig,
    options?: { model?: string; expectedFiles?: string[] },
  ): Promise<JudgeResult>;
}

// ─── Environment Plugin ───

/** Result of executing a command in an environment */
export interface EnvironmentCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Contract for execution environment plugins.
 *
 * An environment plugin controls where and how agent code runs:
 * workspace setup/teardown, command execution, and diff collection.
 *
 * The default is `LocalEnvironment` (Git isolation + native child_process).
 * Alternative implementations include Docker containers, remote VMs via SSH,
 * or temporary directory clones.
 *
 * Lifecycle per test iteration:
 * 1. `setup()` — Prepare workspace (git reset, docker create, etc.)
 * 2. `execute()` — Run commands in the environment (agent, afterEach)
 * 3. `getDiff()` — Capture the code changes
 * 4. `teardown()` — Clean up resources (optional, for containers/VMs)
 *
 * @example
 * ```ts
 * import type { IEnvironmentPlugin } from "agent-eval";
 *
 * class SSHEnvironment implements IEnvironmentPlugin {
 *   readonly name = "ssh";
 *   async setup() { // SSH into remote, clone repo }
 *   async execute(cmd) { // SSH exec command }
 *   async getDiff() { // SSH exec git diff }
 *   async teardown() { // clean up remote workspace }
 * }
 * ```
 */
export interface IEnvironmentPlugin {
  /** Human-readable name of the environment (e.g., "local", "docker", "ssh") */
  readonly name: string;

  /**
   * Prepare the workspace for a test iteration.
   * For local: git reset --hard + git clean -fd.
   * For Docker: create/start container, mount/copy repo.
   *
   * @param cwd - The project root directory
   */
  setup(cwd: string): void | Promise<void>;

  /**
   * Execute a shell command in the environment.
   *
   * @param command - The shell command to run
   * @param cwd - The working directory
   * @param options - Optional execution settings
   * @returns Command output (stdout, stderr, exitCode)
   */
  execute(
    command: string,
    cwd: string,
    options?: { timeout?: number },
  ): EnvironmentCommandResult | Promise<EnvironmentCommandResult>;

  /**
   * Capture the current code diff (staged + unstaged).
   *
   * @param cwd - The project root directory
   * @returns The combined diff string
   */
  getDiff(cwd: string): string | Promise<string>;

  /**
   * Clean up resources after a test iteration.
   * For local: no-op (git reset handles it).
   * For Docker: stop + remove container.
   * Optional — environments that don't need cleanup can omit this.
   *
   * @param cwd - The project root directory
   */
  teardown?(cwd: string): void | Promise<void>;
}
