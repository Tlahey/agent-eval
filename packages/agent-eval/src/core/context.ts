import type { IEnvironmentPlugin } from "./interfaces.js";
import type { CommandResult, TestContext } from "./types.js";

export class EvalContext implements TestContext {
  private _diff: string | null = null;
  private _commands: CommandResult[] = [];
  private _cwd: string;
  private _env: IEnvironmentPlugin;

  constructor(cwd: string, env: IEnvironmentPlugin) {
    this._cwd = cwd;
    this._env = env;
  }

  storeDiff(): void {
    const result = this._env.getDiff(this._cwd);
    // Handle both sync and async getDiff
    if (result instanceof Promise) {
      throw new Error(
        "storeDiff() is synchronous — use an environment plugin with a sync getDiff()",
      );
    }
    this._diff = result as string;
  }

  /** Async version of storeDiff for environments returning promises */
  async storeDiffAsync(): Promise<void> {
    this._diff = await this._env.getDiff(this._cwd);
  }

  async runCommand(name: string, command: string): Promise<CommandResult> {
    const start = Date.now();
    const result = await this._env.execute(command, this._cwd, { timeout: 120_000 });

    const cmd: CommandResult = {
      name,
      command,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      durationMs: Date.now() - start,
    };

    this._commands.push(cmd);
    return cmd;
  }

  get diff(): string | null {
    return this._diff;
  }

  get commands(): CommandResult[] {
    return [...this._commands];
  }

  get logs(): string {
    const parts: string[] = [];

    if (this._diff) {
      parts.push(`── Git Diff ──\n${this._diff}`);
    }

    for (const cmd of this._commands) {
      parts.push(
        `── ${cmd.name} (exit ${cmd.exitCode}, ${cmd.durationMs}ms) ──\n$ ${cmd.command}\n${cmd.stdout}${cmd.stderr ? `\nSTDERR:\n${cmd.stderr}` : ""}`,
      );
    }

    return parts.join("\n\n");
  }
}
