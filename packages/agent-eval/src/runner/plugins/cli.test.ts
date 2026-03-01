import { describe, it, expect, vi } from "vitest";
import { CLIRunner } from "./cli.js";
import type { RunnerContext, IEnvironmentPlugin } from "../../core/interfaces.js";

function createMockEnv(): IEnvironmentPlugin {
  return {
    name: "mock",
    setup: vi.fn(),
    execute: vi.fn(() => ({ stdout: "output", stderr: "", exitCode: 0 })),
    getDiff: vi.fn(() => "diff"),
  };
}

function createContext(env: IEnvironmentPlugin): RunnerContext {
  return { cwd: "/tmp/project", env, timeout: 30_000 };
}

describe("CLIRunner", () => {
  it("has name and model from options", () => {
    const runner = new CLIRunner({ name: "copilot", command: "gh copilot {{prompt}}" });
    expect(runner.name).toBe("copilot");
    expect(runner.model).toBe("gh copilot {{prompt}}");
  });

  it("replaces {{prompt}} placeholder in command", async () => {
    const env = createMockEnv();
    const runner = new CLIRunner({ name: "test", command: "echo {{prompt}}" });

    await runner.execute("hello world", createContext(env));

    expect(env.execute).toHaveBeenCalledWith("echo hello world", "/tmp/project", {
      timeout: 30_000,
    });
  });

  it("returns stdout, stderr and exitCode from env", async () => {
    const env = createMockEnv();
    vi.mocked(env.execute).mockReturnValue({
      stdout: "success output",
      stderr: "warning",
      exitCode: 0,
    });

    const runner = new CLIRunner({ name: "test", command: "run {{prompt}}" });
    const result = await runner.execute("task", createContext(env));

    expect(result.stdout).toBe("success output");
    expect(result.stderr).toBe("warning");
    expect(result.exitCode).toBe(0);
  });

  it("propagates non-zero exit codes", async () => {
    const env = createMockEnv();
    vi.mocked(env.execute).mockReturnValue({
      stdout: "",
      stderr: "command failed",
      exitCode: 1,
    });

    const runner = new CLIRunner({ name: "test", command: "fail {{prompt}}" });
    const result = await runner.execute("task", createContext(env));

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("command failed");
  });

  it("uses default timeout when not specified in context", async () => {
    const env = createMockEnv();
    const runner = new CLIRunner({ name: "test", command: "echo {{prompt}}" });

    await runner.execute("task", { cwd: "/tmp", env });

    expect(env.execute).toHaveBeenCalledWith("echo task", "/tmp", { timeout: 600_000 });
  });
});
