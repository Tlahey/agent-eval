import type { ICliModel, CliOutputParser } from "../../core/interfaces.js";

export interface CliModelOptions {
  /** Shell command template. Use {{prompt}} as placeholder for the instruction. */
  command: string;
  /** Optional display name (defaults to "cli") */
  name?: string;
  /**
   * Optional output parser — extracts token usage and cleaned output from raw CLI output.
   * Each CLI tool reports metrics differently. When undefined, raw stdout is used as-is.
   *
   * @example
   * ```ts
   * // Claude Code with JSON output
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
 * CLI execution model — wraps a shell command with a {{prompt}} placeholder.
 *
 * Use this when the agent is a CLI tool (aider, copilot, claude-code, etc.).
 * The core runner replaces {{prompt}} with the test instruction and executes
 * the command via the configured environment plugin.
 *
 * @example
 * ```ts
 * import { CliModel } from "agent-eval/llm";
 *
 * // Simple CLI (no token parsing)
 * const copilot = new CliModel({
 *   command: 'gh copilot suggest "{{prompt}}"',
 * });
 *
 * // CLI with token usage extraction
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
export class CliModel implements ICliModel {
  readonly type = "cli" as const;
  readonly name: string;
  readonly command: string;
  readonly parseOutput?: CliOutputParser;

  constructor(options: CliModelOptions) {
    this.command = options.command;
    this.name = options.name ?? "cli";
    this.parseOutput = options.parseOutput;
  }
}
