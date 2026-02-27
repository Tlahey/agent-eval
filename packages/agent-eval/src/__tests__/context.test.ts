import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { EvalContext } from "../context.js";

function makeTmpGitRepo(): string {
  const dir = join(tmpdir(), `agenteval-ctx-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  execSync("git init", { cwd: dir, stdio: "pipe" });
  execSync("git config user.email 'test@test.com'", { cwd: dir, stdio: "pipe" });
  execSync("git config user.name 'Test'", { cwd: dir, stdio: "pipe" });
  writeFileSync(join(dir, "file.txt"), "initial");
  execSync("git add -A && git commit -m 'init'", { cwd: dir, stdio: "pipe" });
  return dir;
}

describe("EvalContext", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpGitRepo();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("starts with no diff and no commands", () => {
    const ctx = new EvalContext(tmpDir);
    expect(ctx.diff).toBeNull();
    expect(ctx.commands).toEqual([]);
    expect(ctx.logs).toBe("");
  });

  it("storeDiff captures git changes", () => {
    writeFileSync(join(tmpDir, "file.txt"), "modified");
    const ctx = new EvalContext(tmpDir);
    ctx.storeDiff();

    expect(ctx.diff).toBeTruthy();
    expect(ctx.diff).toContain("modified");
  });

  it("storeDiff returns empty string when no changes", () => {
    const ctx = new EvalContext(tmpDir);
    ctx.storeDiff();
    expect(ctx.diff).toBe("");
  });

  it("runCommand captures stdout for successful commands", async () => {
    const ctx = new EvalContext(tmpDir);
    const result = await ctx.runCommand("echo", "echo hello world");

    expect(result.name).toBe("echo");
    expect(result.command).toBe("echo hello world");
    expect(result.stdout.trim()).toBe("hello world");
    expect(result.exitCode).toBe(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("runCommand captures stderr and exit code for failing commands", async () => {
    const ctx = new EvalContext(tmpDir);
    const result = await ctx.runCommand("fail", "node -e \"process.stderr.write('oops'); process.exit(2)\"");

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("oops");
  });

  it("stores multiple commands", async () => {
    const ctx = new EvalContext(tmpDir);
    await ctx.runCommand("one", "echo first");
    await ctx.runCommand("two", "echo second");

    expect(ctx.commands).toHaveLength(2);
    expect(ctx.commands[0].name).toBe("one");
    expect(ctx.commands[1].name).toBe("two");
  });

  it("commands returns a copy (immutable)", async () => {
    const ctx = new EvalContext(tmpDir);
    await ctx.runCommand("test", "echo ok");

    const cmds = ctx.commands;
    expect(cmds).toHaveLength(1);

    // Mutating the returned array shouldn't affect internal state
    cmds.pop();
    expect(ctx.commands).toHaveLength(1);
  });

  it("logs formats diff and command output", async () => {
    writeFileSync(join(tmpDir, "file.txt"), "changed");
    const ctx = new EvalContext(tmpDir);
    ctx.storeDiff();
    await ctx.runCommand("check", "echo all good");

    const logs = ctx.logs;
    expect(logs).toContain("Git Diff");
    expect(logs).toContain("changed");
    expect(logs).toContain("check");
    expect(logs).toContain("all good");
  });
});
