import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { gitResetHard, gitDiff, gitCurrentBranch, gitHeadSha } from "../git.js";

function makeTmpGitRepo(): string {
  const dir = join(tmpdir(), `agenteval-git-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  execSync("git init", { cwd: dir, stdio: "pipe" });
  execSync("git config user.email 'test@test.com'", { cwd: dir, stdio: "pipe" });
  execSync("git config user.name 'Test'", { cwd: dir, stdio: "pipe" });
  writeFileSync(join(dir, "hello.txt"), "original");
  execSync("git add -A && git commit -m 'init'", { cwd: dir, stdio: "pipe" });
  return dir;
}

describe("git utilities", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpGitRepo();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("gitDiff", () => {
    it("returns empty string when no changes", () => {
      const diff = gitDiff(tmpDir);
      expect(diff).toBe("");
    });

    it("captures unstaged changes", () => {
      writeFileSync(join(tmpDir, "hello.txt"), "modified");
      const diff = gitDiff(tmpDir);
      expect(diff).toContain("modified");
      expect(diff).toContain("original");
    });

    it("captures staged changes", () => {
      writeFileSync(join(tmpDir, "hello.txt"), "staged content");
      execSync("git add -A", { cwd: tmpDir, stdio: "pipe" });
      const diff = gitDiff(tmpDir);
      expect(diff).toContain("staged content");
    });
  });

  describe("gitResetHard", () => {
    it("reverts file modifications", () => {
      writeFileSync(join(tmpDir, "hello.txt"), "dirty");
      gitResetHard(tmpDir);
      const content = readFileSync(join(tmpDir, "hello.txt"), "utf-8");
      expect(content).toBe("original");
    });

    it("removes untracked files", () => {
      writeFileSync(join(tmpDir, "untracked.txt"), "temp");
      gitResetHard(tmpDir);
      expect(existsSync(join(tmpDir, "untracked.txt"))).toBe(false);
    });
  });

  describe("gitCurrentBranch", () => {
    it("returns the current branch name", () => {
      const branch = gitCurrentBranch(tmpDir);
      expect(["main", "master"]).toContain(branch);
    });
  });

  describe("gitHeadSha", () => {
    it("returns a 40-char hex SHA", () => {
      const sha = gitHeadSha(tmpDir);
      expect(sha).toMatch(/^[a-f0-9]{40}$/);
    });
  });
});
