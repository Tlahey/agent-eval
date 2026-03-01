import type { IRunnerPlugin, RunnerContext, RunnerExecResult } from "../../core/interfaces.js";

export interface CLIRunnerOptions {
  /** Unique name for the runner (e.g., "copilot", "aider") */
  name: string;
  /** CLI command template. Use {{prompt}} as placeholder for the instruction. */
  command: string;
}

/**
 * CLI-based agent runner.
 * Executes a shell command with the prompt injected via {{prompt}} placeholder.
 * Delegates actual execution to the environment plugin (local, Docker, etc.).
 *
 * @example
 * ```ts
 * import { CLIRunner } from "agent-eval";
 * const runner = new CLIRunner({
 *   name: "copilot",
 *   command: "gh copilot suggest {{prompt}}",
 * });
 * ```
 */
export class CLIRunner implements IRunnerPlugin {
  readonly name: string;
  readonly model: string;
  private command: string;

  constructor(options: CLIRunnerOptions) {
    this.name = options.name;
    this.command = options.command;
    this.model = options.command;
  }

  async execute(prompt: string, context: RunnerContext): Promise<RunnerExecResult> {
    const cmd = this.command.replace("{{prompt}}", prompt);
    const result = await context.env.execute(cmd, context.cwd, {
      timeout: context.timeout ?? 600_000,
    });
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
    };
  }
}
