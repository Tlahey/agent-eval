import { describe, it, expect, vi, beforeEach } from "vitest";
import { execSync, spawn } from "node:child_process";
import { SandboxExecEnvironment } from "./sandbox-exec.js";
import { platform } from "node:os";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
  spawn: vi.fn(),
}));

vi.mock("node:os", async () => {
  const actual = await vi.importActual<typeof import("node:os")>("node:os");
  return {
    ...actual,
    platform: vi.fn(),
  };
});

describe("SandboxExecEnvironment", () => {
  const mockExecSync = vi.mocked(execSync);
  const mockPlatform = vi.mocked(platform);

  beforeEach(() => {
    vi.clearAllMocks();
    mockPlatform.mockReturnValue("darwin");
  });

  it("has name 'sandbox-exec'", () => {
    const env = new SandboxExecEnvironment();
    expect(env.name).toBe("sandbox-exec");
  });

  it("supports concurrency via tmp folders", () => {
    const env = new SandboxExecEnvironment();
    expect(env.supportsConcurrency).toBe(true);
  });

  describe("setup", () => {
    it("throws if not on macOS", async () => {
      mockPlatform.mockReturnValue("linux");
      const env = new SandboxExecEnvironment();
      await expect(env.setup("/project")).rejects.toThrow("only supported on macOS");
    });

    it("verifies sandbox-exec command exists", async () => {
      const env = new SandboxExecEnvironment();
      await env.setup("/project");
      expect(mockExecSync).toHaveBeenCalledWith("which sandbox-exec", expect.any(Object));
    });
  });

  describe("prepareRun", () => {
    it("clones the project to a tmp dir", async () => {
      const env = new SandboxExecEnvironment();
      const run = await env.prepareRun("/project", "run1");

      expect(run.workingDir).toContain("agenteval-sandbox-");
      // Use a more flexible match for the cp command
      const calls = mockExecSync.mock.calls;
      const cpCall = calls.find((c) => String(c[0]).includes("cp -R"));
      expect(cpCall).toBeDefined();
    });
  });

  describe("execute", () => {
    it("runs sandbox-exec with the correct profile", async () => {
      const env = new SandboxExecEnvironment();

      const mockChild = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, cb) => {
          if (event === "close") cb(0);
        }),
      };
      vi.mocked(spawn).mockReturnValue(mockChild as any);

      await env.execute("ls", "/tmp/work");

      expect(spawn).toHaveBeenCalledWith(
        "sandbox-exec",
        expect.arrayContaining(["-p", "(version 1) (allow default)"]),
        expect.anything(),
      );
    });
  });
});
