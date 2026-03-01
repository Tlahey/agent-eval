import type { ICliModel } from "../../core/interfaces.js";

export interface CliModelOptions {
  /** Shell command template. Use {{prompt}} as placeholder for the instruction. */
  command: string;
  /** Optional display name (defaults to "cli") */
  name?: string;
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
 * import { CliModel } from "agent-eval/providers/cli";
 *
 * const aider = new CliModel({
 *   command: 'aider --message "{{prompt}}" --yes --no-auto-commits',
 * });
 *
 * // In config:
 * runners: [
 *   { name: "aider", model: aider },
 * ]
 * ```
 */
export class CliModel implements ICliModel {
  readonly type = "cli" as const;
  readonly name: string;
  readonly command: string;

  constructor(options: CliModelOptions) {
    this.command = options.command;
    this.name = options.name ?? "cli";
  }
}
