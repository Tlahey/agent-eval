/**
 * Plugin interfaces for the AgentEval SOLID architecture.
 *
 * These interfaces define the contracts for:
 * - IModelPlugin: LLM provider (Anthropic, OpenAI, Ollama, custom)
 * - ICliModel: CLI execution model (shell commands with {{prompt}})
 * - ILedgerPlugin: Storage backend (SQLite, JSON, custom)
 * - IEnvironmentPlugin: Execution environment (Local, Docker, custom)
 * - IJudgePlugin: Evaluation judge (API, CLI, custom)
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

/**
 * Generation settings passed to the LLM at call time.
 * These are forwarded to `generateObject()` / `generateText()` calls.
 */
export interface ModelSettings {
  /** Sampling temperature (0 = deterministic, 1 = creative). */
  temperature?: number;
  /** Maximum tokens in the response. */
  maxTokens?: number;
  /** Nucleus sampling threshold (0-1). */
  topP?: number;
  /** Maximum number of tool-calling rounds (multi-step agentic). Default: 10. */
  maxSteps?: number;
}

/**
 * Contract for LLM model providers.
 *
 * Wraps a Vercel AI SDK model instance. The framework calls `createModel()`
 * to get a model that can be passed to `generateObject()` / `generateText()`.
 *
 * Built-in: AnthropicModel, OpenAIModel, OllamaModel, GitHubModelsModel.
 * Third parties can implement this to add any provider (Mistral, Gemini, etc.).
 *
 * @example
 * ```ts
 * import type { IModelPlugin } from "agent-eval";
 * import { createMistral } from "@ai-sdk/mistral";
 *
 * class MistralModel implements IModelPlugin {
 *   readonly name = "mistral";
 *   constructor(private opts: { model: string; apiKey?: string }) {}
 *   createModel() {
 *     const provider = createMistral({ apiKey: this.opts.apiKey });
 *     return provider(this.opts.model);
 *   }
 * }
 * ```
 */
export interface IModelPlugin {
  /** Human-readable name of the model provider (e.g., "anthropic", "openai") */
  readonly name: string;

  /** Model identifier (e.g., "claude-3-5-sonnet-latest", "gpt-4o") */
  readonly modelId: string;

  /**
   * Optional generation settings forwarded to `generateObject()` / `generateText()`.
   * These override the framework defaults (temperature, maxTokens, topP, maxSteps).
   */
  readonly settings?: ModelSettings;

  /**
   * Optional AI SDK tools the model can use during execution.
   * When tools are present, the runner uses `generateText()` with multi-step tool calling
   * instead of `generateObject()` for file operations.
   *
   * The tools are passed directly to the AI SDK — define any tools you need
   * (readFile, writeFile, runCommand, etc.) and the model will call them autonomously.
   * File changes are captured by `storeDiff()` via git, not by the framework.
   *
   * @see https://ai-sdk.dev/docs/foundations/tools
   *
   * @example
   * ```ts
   * import { tool } from "ai";
   * import { z } from "zod";
   *
   * new GitHubModelsModel({
   *   model: "openai/gpt-5-mini",
   *   tools: {
   *     readFile: tool({
   *       description: "Read a file from the project",
   *       parameters: z.object({ path: z.string() }),
   *       execute: async ({ path }) => fs.readFileSync(path, "utf-8"),
   *     }),
   *     writeFile: tool({
   *       description: "Write content to a file",
   *       parameters: z.object({ path: z.string(), content: z.string() }),
   *       execute: async ({ path, content }) => { fs.writeFileSync(path, content); return "ok"; },
   *     }),
   *   },
   * })
   * ```
   */
  readonly tools?: Record<string, unknown>;

  /**
   * Create and return a Vercel AI SDK LanguageModel instance.
   * May be async for providers that use dynamic imports.
   */
  createModel(): unknown | Promise<unknown>;
}

// ─── CLI Execution Model ───

/**
 * Contract for CLI-based execution models.
 *
 * A CLI model wraps a shell command template with a `{{prompt}}` placeholder.
 * The core runner replaces `{{prompt}}` with the test instruction and executes
 * the command via the environment plugin.
 *
 * Built-in: `CliModel` from `agent-eval/llm`.
 *
 * @example
 * ```ts
 * import { CliModel } from "agent-eval/llm";
 *
 * const aider = new CliModel({
 *   command: 'aider --message "{{prompt}}" --yes --no-auto-commits',
 * });
 * ```
 */
/**
 * Metrics extracted from CLI command output.
 * Returned by `ICliModel.parseOutput()` when the CLI tool exposes usage data.
 */
export interface CliOutputMetrics {
  /** Token usage extracted from the CLI output (undefined if not available) */
  tokenUsage?: TokenUsage;
  /** Cleaned agent output (e.g., extracted from JSON wrapper) */
  agentOutput?: string;
}

/**
 * Parser function type for CLI output.
 * Each CLI tool may expose metrics in a different format — the parser
 * is responsible for extracting structured data from raw stdout/stderr.
 */
export type CliOutputParser = (output: { stdout: string; stderr: string }) => CliOutputMetrics;

export interface ICliModel {
  /** Always "cli" — used to discriminate from IModelPlugin */
  readonly type: "cli";
  /** Human-readable name (e.g., "aider", "copilot") */
  readonly name: string;
  /** Shell command template with {{prompt}} placeholder */
  readonly command: string;

  /**
   * Optional output parser — extracts token usage and cleaned output from raw CLI output.
   *
   * Each CLI tool reports metrics differently (or not at all):
   * - Claude Code (`--output-format json`): structured JSON with `usage` field
   * - Aider: prints "Tokens: Xk sent, Yk received" in stdout
   * - Copilot CLI: no token reporting — leave parseOutput undefined
   *
   * When undefined, the runner uses raw stdout as agent output with no token data.
   *
   * @example
   * ```ts
   * const claudeCode = new CliModel({
   *   command: 'claude -p "{{prompt}}" --output-format json',
   *   parseOutput: ({ stdout }) => {
   *     const json = JSON.parse(stdout);
   *     return {
   *       tokenUsage: json.usage ? {
   *         inputTokens: json.usage.input_tokens,
   *         outputTokens: json.usage.output_tokens,
   *         totalTokens: json.usage.input_tokens + json.usage.output_tokens,
   *       } : undefined,
   *       agentOutput: json.result,
   *     };
   *   },
   * });
   * ```
   */
  parseOutput?: CliOutputParser;
}

/**
 * Type guard: check if a model is a CLI execution model.
 */
export function isCliModel(model: IModelPlugin | ICliModel): model is ICliModel {
  return "type" in model && (model as ICliModel).type === "cli";
}

// ─── Runner Execution Context ───

/** Context provided to the core runner during execution */
export interface RunnerContext {
  /** Working directory of the project */
  cwd: string;
  /** Environment plugin for command execution */
  env: IEnvironmentPlugin;
  /** Timeout in ms */
  timeout?: number;
}

/** Result returned after runner execution */
export interface RunnerExecResult {
  /** stdout from execution (CLI models) */
  stdout?: string;
  /** stderr from execution (CLI models) */
  stderr?: string;
  /** Exit code (CLI models, 0 = success) */
  exitCode?: number;
  /** Files written to disk (API models) */
  filesWritten?: string[];
  /** Token usage from the LLM call (API models) */
  tokenUsage?: import("./types.js").TokenUsage;
  /** Raw output text (LLM response body for API models) */
  output?: string;
}

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
 * 2. `execute()` — Run commands in the environment (agent commands)
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
