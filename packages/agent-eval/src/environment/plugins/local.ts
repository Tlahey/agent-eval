/**
 * Local Git environment plugin — the default execution environment.
 *
 * Uses native `child_process.execSync` for command execution and
 * Git CLI for workspace isolation (reset --hard, clean -fd) and diff collection.
 *
 * This is the zero-dependency fallback when no `environment` plugin is configured.
 */

import { execSync, spawn } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type {
  IEnvironmentPlugin,
  EnvironmentCommandResult,
  EnvironmentExecOptions,
} from "../../core/interfaces.js";

export class LocalEnvironment implements IEnvironmentPlugin {
  readonly name = "local";
  private initialDiff: string | null = null;

  /**
   * Capture current uncommitted changes to restore them later.
   * Does NOT clean the base yet, allowing the test lifecycle to control isolation.
   */
  setup(cwd: string): void {
    try {
      this.initialDiff = execSync("git diff HEAD", { cwd, encoding: "utf-8" });
    } catch {
      this.initialDiff = null;
    }
  }

  /**
   * Execute a shell command using native child_process.
   * When onStdout/onStderr callbacks are provided, uses spawn for real-time streaming.
   * Otherwise uses execSync for simplicity.
   */
  execute(
    command: string,
    cwd: string,
    options?: EnvironmentExecOptions,
  ): EnvironmentCommandResult | Promise<EnvironmentCommandResult> {
    const hasStreaming = options?.onStdout || options?.onStderr;

    if (hasStreaming) {
      return this.executeStreaming(command, cwd, options!);
    }

    return this.executeSync(command, cwd, options?.timeout);
  }

  private executeSync(command: string, cwd: string, timeout?: number): EnvironmentCommandResult {
    try {
      const stdout = execSync(command, {
        cwd,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
        timeout: timeout ?? 120_000,
      });
      return { stdout, stderr: "", exitCode: 0 };
    } catch (err: unknown) {
      const e = err as { stdout?: string; stderr?: string; status?: number };
      return {
        stdout: e.stdout ?? "",
        stderr: e.stderr ?? "",
        exitCode: e.status ?? 1,
      };
    }
  }

  private executeStreaming(
    command: string,
    cwd: string,
    options: EnvironmentExecOptions,
  ): Promise<EnvironmentCommandResult> {
    return new Promise((resolve) => {
      const child = spawn("sh", ["-c", command], {
        cwd,
        stdio: ["pipe", "pipe", "pipe"],
      });

      const stdoutChunks: string[] = [];
      const stderrChunks: string[] = [];
      let settled = false;

      const timeout = options.timeout ?? 120_000;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          child.kill("SIGTERM");
          resolve({
            stdout: stdoutChunks.join(""),
            stderr: stderrChunks.join("") + "\n[timeout]",
            exitCode: 124,
          });
        }
      }, timeout);

      child.stdout?.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        stdoutChunks.push(text);
        options.onStdout?.(text);
      });

      child.stderr?.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        stderrChunks.push(text);
        options.onStderr?.(text);
      });

      child.on("close", (code) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve({
            stdout: stdoutChunks.join(""),
            stderr: stderrChunks.join(""),
            exitCode: code ?? 0,
          });
        }
      });

      child.on("error", (err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve({
            stdout: stdoutChunks.join(""),
            stderr: stderrChunks.join("") + "\n" + err.message,
            exitCode: 1,
          });
        }
      });
    });
  }

  /**
   * Capture staged + unstaged git diff, including new files.
   */
  getDiff(cwd: string): string {
    try {
      // Intent-to-add untracked files so they show up in git diff
      execSync("git add -N .", { cwd, stdio: "pipe" });
    } catch {
      // Ignore if not a git repo or other issues
    }

    const diff = execSync("git diff HEAD", {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return diff || "";
  }

  /**
   * Rollback agent modifications and restore the original uncommitted changes.
   * This is called after the judge has finished its evaluation.
   */
  teardown(cwd: string): void {
    // 1. Clean all agent changes but preserve the ledger output directory
    try {
      execSync("git reset --hard HEAD", { cwd, stdio: "pipe" });
      execSync("git clean -fd -e .agenteval", { cwd, stdio: "pipe" });
    } catch {
      // Ignore cleanup errors
    }

    // 2. Restore user's original uncommitted changes that were present before setup()
    if (this.initialDiff && this.initialDiff.trim()) {
      const patchPath = join(cwd, ".agenteval_backup.patch");
      try {
        writeFileSync(patchPath, this.initialDiff);
        execSync(`git apply ${patchPath}`, { cwd, stdio: "pipe" });
      } catch {
        // Ignore apply errors, best effort restoration
      } finally {
        try {
          unlinkSync(patchPath);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }
}
