/**
 * Docker environment plugin — sandboxed container execution.
 *
 * Spins up a Docker container per test iteration, mounts the project repo,
 * and executes agent commands inside the container. Provides full isolation
 * and reproducibility.
 *
 * Requires Docker to be installed and accessible on the host.
 */

import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import type { IEnvironmentPlugin, EnvironmentCommandResult } from "../../core/interfaces.js";

export interface DockerEnvironmentOptions {
  /** Docker image to use (e.g., "node:22", "ubuntu:24.04") */
  image: string;
  /** Optional Dockerfile path to build from instead of using a pre-built image */
  dockerfile?: string;
  /** Working directory inside the container (defaults to /workspace) */
  workDir?: string;
  /** Extra docker run flags (e.g., ["--network=host", "--env=CI=true"]) */
  dockerArgs?: string[];
}

export class DockerEnvironment implements IEnvironmentPlugin {
  readonly name = "docker";
  private readonly image: string;
  private readonly dockerfile?: string;
  private readonly workDir: string;
  private readonly dockerArgs: string[];
  private containerId: string | null = null;

  constructor(options: DockerEnvironmentOptions) {
    this.image = options.image;
    this.dockerfile = options.dockerfile;
    this.workDir = options.workDir ?? "/workspace";
    this.dockerArgs = options.dockerArgs ?? [];
  }

  /**
   * Build image if needed, then create and start a container
   * with the project directory mounted.
   */
  async setup(cwd: string): Promise<void> {
    // Build from Dockerfile if specified
    if (this.dockerfile) {
      const tag = `agenteval-${randomBytes(4).toString("hex")}`;
      execSync(`docker build -t ${tag} -f ${this.dockerfile} .`, {
        cwd,
        stdio: "pipe",
        timeout: 300_000,
      });
      this.containerId = this.createContainer(tag, cwd);
    } else {
      this.containerId = this.createContainer(this.image, cwd);
    }
  }

  /**
   * Execute a command inside the running container via `docker exec`.
   */
  execute(command: string, _cwd: string, options?: { timeout?: number }): EnvironmentCommandResult {
    if (!this.containerId) {
      return { stdout: "", stderr: "Container not started", exitCode: 1 };
    }

    try {
      const stdout = execSync(
        `docker exec -w ${this.workDir} ${this.containerId} sh -c ${JSON.stringify(command)}`,
        {
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
          timeout: options?.timeout ?? 120_000,
        },
      );
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
   * Capture git diff from inside the container.
   */
  getDiff(_cwd: string): string {
    if (!this.containerId) return "";

    const staged = this.execInContainer("git diff --cached");
    const unstaged = this.execInContainer("git diff");
    return [staged, unstaged].filter(Boolean).join("\n");
  }

  /**
   * Stop and remove the container, cleaning up resources.
   */
  async teardown(_cwd: string): Promise<void> {
    if (this.containerId) {
      try {
        execSync(`docker rm -f ${this.containerId}`, { stdio: "pipe" });
      } catch {
        // Container may already be removed
      }
      this.containerId = null;
    }
  }

  // ─── Private helpers ───

  private createContainer(image: string, cwd: string): string {
    const extraArgs = this.dockerArgs.length > 0 ? this.dockerArgs.join(" ") + " " : "";
    const id = execSync(
      `docker create ${extraArgs}-v ${cwd}:${this.workDir} -w ${this.workDir} ${image} sleep infinity`,
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
    ).trim();
    execSync(`docker start ${id}`, { stdio: "pipe" });
    return id;
  }

  private execInContainer(command: string): string {
    try {
      return execSync(
        `docker exec -w ${this.workDir} ${this.containerId} sh -c ${JSON.stringify(command)}`,
        { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
      );
    } catch {
      return "";
    }
  }
}
