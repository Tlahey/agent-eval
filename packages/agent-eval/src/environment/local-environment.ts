/**
 * Local Git environment plugin — the default execution environment.
 *
 * Uses native `child_process.execSync` for command execution and
 * Git CLI for workspace isolation (reset --hard, clean -fd) and diff collection.
 *
 * This is the zero-dependency fallback when no `environment` plugin is configured.
 */

import { execSync } from "node:child_process";
import type { IEnvironmentPlugin, EnvironmentCommandResult } from "../core/interfaces.js";

export class LocalEnvironment implements IEnvironmentPlugin {
  readonly name = "local";

  /**
   * Reset git state: `git reset --hard HEAD` + `git clean -fd`.
   * Guarantees a pristine working directory before each test iteration.
   */
  setup(cwd: string): void {
    execSync("git reset --hard HEAD", { cwd, stdio: "pipe" });
    execSync("git clean -fd", { cwd, stdio: "pipe" });
  }

  /**
   * Execute a shell command using native child_process.
   */
  execute(command: string, cwd: string, options?: { timeout?: number }): EnvironmentCommandResult {
    try {
      const stdout = execSync(command, {
        cwd,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
        timeout: options?.timeout ?? 120_000,
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

  /**
   * Capture staged + unstaged git diff.
   */
  getDiff(cwd: string): string {
    const staged = execSync("git diff --cached", {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    const unstaged = execSync("git diff", {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return [staged, unstaged].filter(Boolean).join("\n");
  }
}
