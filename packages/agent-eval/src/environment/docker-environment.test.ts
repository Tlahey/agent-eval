import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock child_process before importing DockerEnvironment
const mockExecSync = vi.fn();
vi.mock("node:child_process", () => ({
  execSync: (...args: unknown[]) => mockExecSync(...args),
}));

vi.mock("node:crypto", () => ({
  randomBytes: () => ({ toString: () => "deadbeef" }),
}));

import { DockerEnvironment } from "./docker-environment.js";

describe("DockerEnvironment", () => {
  let env: DockerEnvironment;

  beforeEach(() => {
    vi.clearAllMocks();
    env = new DockerEnvironment({ image: "node:22" });
  });

  it("has name 'docker'", () => {
    expect(env.name).toBe("docker");
  });

  describe("setup", () => {
    it("creates and starts a container with volume mount", async () => {
      mockExecSync
        .mockReturnValueOnce("abc123\n") // docker create
        .mockReturnValueOnce(""); // docker start

      await env.setup("/project");

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining("docker create"),
        expect.any(Object),
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining("-v /project:/workspace"),
        expect.any(Object),
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining("docker start abc123"),
        expect.any(Object),
      );
    });

    it("builds from Dockerfile when specified", async () => {
      const envWithDockerfile = new DockerEnvironment({
        image: "node:22",
        dockerfile: "Dockerfile.test",
      });

      mockExecSync
        .mockReturnValueOnce("") // docker build
        .mockReturnValueOnce("container-id\n") // docker create
        .mockReturnValueOnce(""); // docker start

      await envWithDockerfile.setup("/project");

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining("docker build -t agenteval-deadbeef"),
        expect.objectContaining({ cwd: "/project" }),
      );
    });

    it("passes extra docker args", async () => {
      const envWithArgs = new DockerEnvironment({
        image: "node:22",
        dockerArgs: ["--network=host", "--env=CI=true"],
      });

      mockExecSync
        .mockReturnValueOnce("xyz789\n") // docker create
        .mockReturnValueOnce(""); // docker start

      await envWithArgs.setup("/project");

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining("--network=host --env=CI=true"),
        expect.any(Object),
      );
    });
  });

  describe("execute", () => {
    it("returns error when container not started", () => {
      const result = env.execute("echo hi", "/project");
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Container not started");
    });

    it("runs docker exec with the command", async () => {
      mockExecSync
        .mockReturnValueOnce("cid\n") // docker create
        .mockReturnValueOnce(""); // docker start

      await env.setup("/project");

      mockExecSync.mockReturnValueOnce("output");

      const result = env.execute("echo hello", "/project");
      expect(result.stdout).toBe("output");
      expect(result.exitCode).toBe(0);

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining("docker exec -w /workspace cid"),
        expect.any(Object),
      );
    });

    it("captures errors from docker exec", async () => {
      mockExecSync
        .mockReturnValueOnce("cid\n") // docker create
        .mockReturnValueOnce(""); // docker start

      await env.setup("/project");

      mockExecSync.mockImplementationOnce(() => {
        const err = new Error("fail") as Error & {
          stdout: string;
          stderr: string;
          status: number;
        };
        err.stdout = "";
        err.stderr = "command not found";
        err.status = 127;
        throw err;
      });

      const result = env.execute("badcmd", "/project");
      expect(result.exitCode).toBe(127);
      expect(result.stderr).toContain("command not found");
    });
  });

  describe("getDiff", () => {
    it("returns empty string when no container", () => {
      expect(env.getDiff("/project")).toBe("");
    });

    it("runs git diff inside container", async () => {
      mockExecSync
        .mockReturnValueOnce("cid\n") // docker create
        .mockReturnValueOnce(""); // docker start

      await env.setup("/project");

      mockExecSync
        .mockReturnValueOnce("staged diff") // git diff --cached
        .mockReturnValueOnce("unstaged diff"); // git diff

      const diff = env.getDiff("/project");
      expect(diff).toContain("staged diff");
      expect(diff).toContain("unstaged diff");
    });
  });

  describe("teardown", () => {
    it("removes the container", async () => {
      mockExecSync
        .mockReturnValueOnce("cid\n") // docker create
        .mockReturnValueOnce(""); // docker start

      await env.setup("/project");

      mockExecSync.mockReturnValueOnce(""); // docker rm

      await env.teardown("/project");

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining("docker rm -f cid"),
        expect.any(Object),
      );
    });

    it("does nothing when no container exists", async () => {
      mockExecSync.mockClear();
      await env.teardown("/project");
      expect(mockExecSync).not.toHaveBeenCalled();
    });

    it("handles already-removed container gracefully", async () => {
      mockExecSync
        .mockReturnValueOnce("cid\n") // docker create
        .mockReturnValueOnce(""); // docker start

      await env.setup("/project");

      mockExecSync.mockImplementationOnce(() => {
        throw new Error("No such container");
      });

      // Should not throw
      await env.teardown("/project");
    });
  });

  describe("custom workDir", () => {
    it("uses custom working directory", async () => {
      const envCustom = new DockerEnvironment({
        image: "node:22",
        workDir: "/app",
      });

      mockExecSync
        .mockReturnValueOnce("cid\n") // docker create
        .mockReturnValueOnce(""); // docker start

      await envCustom.setup("/project");

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining("-w /app"),
        expect.any(Object),
      );
    });
  });
});
