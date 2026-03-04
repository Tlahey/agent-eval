import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { LocalEnvironment } from "./local.js";

function makeTmpGitRepo(): string {
  const dir = join(tmpdir(), `agenteval-env-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  execSync("git init", { cwd: dir, stdio: "pipe" });
  execSync("git config user.email 'test@test.com'", { cwd: dir, stdio: "pipe" });
  execSync("git config user.name 'Test'", { cwd: dir, stdio: "pipe" });
  writeFileSync(join(dir, "file.txt"), "initial");
  execSync("git add -A && git commit -m 'init'", { cwd: dir, stdio: "pipe" });
  return dir;
}

describe("LocalEnvironment", () => {
  let tmpDir: string;
  let env: LocalEnvironment;

  beforeEach(() => {
    tmpDir = makeTmpGitRepo();
    env = new LocalEnvironment();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("has name 'local'", () => {
    expect(env.name).toBe("local");
  });

  describe("setup and teardown", () => {
    it("preserves uncommitted changes during setup and restores them after teardown", () => {
      // 1. User makes uncommitted changes
      writeFileSync(join(tmpDir, "file.txt"), "user change");

      // 2. Setup captures state but leaves working directory dirty
      env.setup(tmpDir);
      let content = execSync("cat file.txt", { cwd: tmpDir, encoding: "utf-8" });
      expect(content).toBe("user change");

      // 3. Simulate agent making further changes
      writeFileSync(join(tmpDir, "file.txt"), "agent change");
      writeFileSync(join(tmpDir, "agent_new.txt"), "agent file");

      // 4. Teardown rolls back agent changes and restores user's initial dirty state
      env.teardown(tmpDir);
      content = execSync("cat file.txt", { cwd: tmpDir, encoding: "utf-8" });
      expect(content).toBe("user change");

      const ls = execSync("ls", { cwd: tmpDir, encoding: "utf-8" });
      expect(ls).not.toContain("agent_new.txt");
    });

    it("works correctly when there are no initial uncommitted changes", () => {
      env.setup(tmpDir);

      writeFileSync(join(tmpDir, "file.txt"), "agent change");

      env.teardown(tmpDir);

      const content = execSync("cat file.txt", { cwd: tmpDir, encoding: "utf-8" });
      expect(content).toBe("initial");
    });
  });

  describe("execute", () => {
    it("captures stdout for successful commands", async () => {
      const result = await env.execute("echo hello", tmpDir);
      expect(result.stdout.trim()).toBe("hello");
      expect(result.stderr).toBe("");
      expect(result.exitCode).toBe(0);
    });

    it("captures stderr and exit code for failing commands", async () => {
      const result = await env.execute(
        "node -e \"process.stderr.write('oops'); process.exit(2)\"",
        tmpDir,
      );
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("oops");
    });

    it("respects timeout option", async () => {
      const result = await env.execute("sleep 10", tmpDir, { timeout: 100 });
      // Should exit with non-zero (killed by timeout)
      expect(result.exitCode).not.toBe(0);
    });

    it("streams stdout via onStdout callback", async () => {
      const chunks: string[] = [];
      const result = await env.execute('echo "line1" && echo "line2"', tmpDir, {
        onStdout: (data) => chunks.push(data),
      });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("line1");
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.join("")).toContain("line1");
    });
  });

  describe("getDiff", () => {
    it("returns empty string when no changes", () => {
      const diff = env.getDiff(tmpDir);
      expect(diff).toBe("");
    });

    it("captures unstaged changes", () => {
      writeFileSync(join(tmpDir, "file.txt"), "changed content");
      const diff = env.getDiff(tmpDir);
      expect(diff).toContain("changed content");
    });

    it("captures staged changes", () => {
      writeFileSync(join(tmpDir, "file.txt"), "staged content");
      execSync("git add file.txt", { cwd: tmpDir, stdio: "pipe" });
      const diff = env.getDiff(tmpDir);
      expect(diff).toContain("staged content");
    });
  });

  describe("edge cases", () => {
    it("setup handles non-git directories gracefully", () => {
      const nonGitDir = join(tmpdir(), `agenteval-nongit-${Date.now()}`);
      mkdirSync(nonGitDir, { recursive: true });
      try {
        expect(() => env.setup(nonGitDir)).not.toThrow();
      } finally {
        rmSync(nonGitDir, { recursive: true, force: true });
      }
    });

    it("teardown handles patch apply failure gracefully", () => {
      // Make uncommitted changes to set initialDiff
      writeFileSync(join(tmpDir, "file.txt"), "user change");
      env.setup(tmpDir);

      // Delete the file so git apply will fail
      execSync("git reset --hard HEAD", { cwd: tmpDir, stdio: "pipe" });
      execSync("git clean -fd", { cwd: tmpDir, stdio: "pipe" });
      writeFileSync(join(tmpDir, "conflict.txt"), "conflicting file");
      execSync("git add -A && git commit -m 'conflict'", { cwd: tmpDir, stdio: "pipe" });

      // Teardown should not throw even if apply fails
      expect(() => env.teardown(tmpDir)).not.toThrow();
    });
  });
});
