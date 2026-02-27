import { execSync } from "node:child_process";
import { gitDiff } from "../git/git.js";
import type { CommandResult, TestContext } from "./types.js";

export class EvalContext implements TestContext {
  private _diff: string | null = null;
  private _commands: CommandResult[] = [];
  private _cwd: string;

  constructor(cwd: string) {
    this._cwd = cwd;
  }

  storeDiff(): void {
    this._diff = gitDiff(this._cwd);
  }

  async runCommand(name: string, command: string): Promise<CommandResult> {
    const start = Date.now();
    let stdout: string;
    let stderr = "";
    let exitCode = 0;

    try {
      stdout = execSync(command, {
        cwd: this._cwd,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 120_000,
      });
    } catch (err: unknown) {
      const e = err as {
        stdout?: string;
        stderr?: string;
        status?: number;
      };
      stdout = e.stdout ?? "";
      stderr = e.stderr ?? "";
      exitCode = e.status ?? 1;
    }

    const result: CommandResult = {
      name,
      command,
      stdout,
      stderr,
      exitCode,
      durationMs: Date.now() - start,
    };

    this._commands.push(result);
    return result;
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
