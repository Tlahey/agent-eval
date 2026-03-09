import { execSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir, platform } from "node:os";
import type {
  IEnvironmentPlugin,
  EnvironmentCommandResult,
  EnvironmentExecOptions,
} from "../../core/interfaces.js";

export interface SandboxExecOptions {
  /** Custom seatbelt profile content or path */
  profile?: string;
  /** Allow all filesystem read/write (permissive mode) */
  permissive?: boolean;
}

/**
 * macOS-specific environment using sandbox-exec (Seatbelt).
 * Isolates processes while allowing controlled filesystem access.
 */
export class SandboxExecEnvironment implements IEnvironmentPlugin {
  readonly name = "sandbox-exec";
  readonly supportsConcurrency = true; // Enabled via tmp folders
  private tmpDirs: Map<string, string> = new Map();

  constructor(private options: SandboxExecOptions = { permissive: true }) {}

  async setup(cwd: string): Promise<void> {
    if (platform() !== "darwin") {
      throw new Error("SandboxExecEnvironment is only supported on macOS (darwin).");
    }
    // Verify sandbox-exec command exists
    try {
      execSync("which sandbox-exec", { stdio: "pipe" });
    } catch {
      throw new Error("sandbox-exec command not found on this system.");
    }
  }

  async prepareRun(
    cwd: string,
    runId: string,
  ): Promise<{ workingDir: string; cleanup: () => Promise<void> }> {
    // For concurrency, we MUST have separate folders.
    const baseTmp = mkdtempSync(join(tmpdir(), "agenteval-sandbox-"));

    // Copy the whole project to the tmp dir (this provides filesystem isolation)
    // -a: archive mode (preserve perms), -r: recursive
    execSync(`cp -R "${cwd}/." "${baseTmp}"`);

    this.tmpDirs.set(runId, baseTmp);

    return {
      workingDir: baseTmp,
      cleanup: async () => {
        rmSync(baseTmp, { recursive: true, force: true });
        this.tmpDirs.delete(runId);
      },
    };
  }

  async execute(
    command: string,
    cwd: string,
    options?: EnvironmentExecOptions,
  ): Promise<EnvironmentCommandResult> {
    const profile = this.options.profile ?? "(version 1) (allow default)";

    return new Promise((resolve) => {
      // sandbox-exec -p 'profile' command
      const child = spawn("sandbox-exec", ["-p", profile, "sh", "-c", command], {
        cwd,
        stdio: ["pipe", "pipe", "pipe"],
      });

      const stdoutChunks: string[] = [];
      const stderrChunks: string[] = [];
      let settled = false;

      const timeout = options?.timeout ?? 120_000;
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

      child.stdout?.on("data", (chunk) => {
        const text = chunk.toString();
        stdoutChunks.push(text);
        options?.onStdout?.(text);
      });

      child.stderr?.on("data", (chunk) => {
        const text = chunk.toString();
        stderrChunks.push(text);
        options?.onStderr?.(text);
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
    });
  }

  async getDiff(cwd: string): Promise<string> {
    try {
      execSync("git add -N .", { cwd, stdio: "pipe" });
      return execSync("git diff HEAD", { cwd, encoding: "utf-8" });
    } catch {
      return "";
    }
  }

  async teardown(cwd: string): Promise<void> {
    for (const dir of this.tmpDirs.values()) {
      rmSync(dir, { recursive: true, force: true });
    }
    this.tmpDirs.clear();
  }
}
