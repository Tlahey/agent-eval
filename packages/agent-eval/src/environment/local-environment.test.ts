import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { LocalEnvironment } from "./local-environment.js";

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

  describe("setup", () => {
    it("resets modified files to HEAD", () => {
      writeFileSync(join(tmpDir, "file.txt"), "modified");
      env.setup(tmpDir);

      const content = execSync("cat file.txt", { cwd: tmpDir, encoding: "utf-8" });
      expect(content).toBe("initial");
    });

    it("removes untracked files", () => {
      writeFileSync(join(tmpDir, "untracked.txt"), "temp");
      env.setup(tmpDir);

      const result = execSync("ls", { cwd: tmpDir, encoding: "utf-8" });
      expect(result).not.toContain("untracked.txt");
    });
  });

  describe("execute", () => {
    it("captures stdout for successful commands", () => {
      const result = env.execute("echo hello", tmpDir);
      expect(result.stdout.trim()).toBe("hello");
      expect(result.stderr).toBe("");
      expect(result.exitCode).toBe(0);
    });

    it("captures stderr and exit code for failing commands", () => {
      const result = env.execute(
        "node -e \"process.stderr.write('oops'); process.exit(2)\"",
        tmpDir,
      );
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("oops");
    });

    it("respects timeout option", () => {
      const result = env.execute("sleep 10", tmpDir, { timeout: 100 });
      // Should exit with non-zero (killed by timeout)
      expect(result.exitCode).not.toBe(0);
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
});
