import { execSync } from "node:child_process";

/**
 * Reset git state to HEAD and remove untracked files.
 * Guarantees a pristine working directory before each test iteration.
 */
export function gitResetHard(cwd: string): void {
  execSync("git reset --hard HEAD", { cwd, stdio: "pipe" });
  execSync("git clean -fd", { cwd, stdio: "pipe" });
}

/**
 * Capture the current git diff (staged + unstaged).
 */
export function gitDiff(cwd: string): string {
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

/**
 * Get the current git branch name.
 */
export function gitCurrentBranch(cwd: string): string {
  return execSync("git rev-parse --abbrev-ref HEAD", {
    cwd,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}

/**
 * Get the current git HEAD commit hash.
 */
export function gitHeadSha(cwd: string): string {
  return execSync("git rev-parse HEAD", {
    cwd,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}
