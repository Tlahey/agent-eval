import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { tmpdir } from "node:os";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { EvalContext } from "../core/context.js";
import { appendLedgerEntry, readLedger } from "../ledger/ledger.js";
import { gitResetHard, gitDiff } from "../git/git.js";
import type { LedgerEntry, AgentEvalConfig, TestDefinition } from "../core/types.js";

/**
 * E2E Integration Test
 *
 * Validates the full AgentEval pipeline without real LLM API keys:
 * 1. Create a temp git repo with a source file
 * 2. Simulate an agent mutating files
 * 3. Capture git diff via EvalContext
 * 4. Run a command in context
 * 5. Write results to SQLite ledger
 * 6. Verify ledger contains the expected data
 * 7. Verify git reset restores pristine state
 */

function createTempRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "agenteval-e2e-"));
  execSync("git init", { cwd: dir, stdio: "ignore" });
  execSync('git config user.email "test@test.com"', { cwd: dir, stdio: "ignore" });
  execSync('git config user.name "Test"', { cwd: dir, stdio: "ignore" });

  // Create initial source file
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(
    join(dir, "src", "hello.ts"),
    'export function hello() {\n  return "Hello World";\n}\n'
  );
  writeFileSync(
    join(dir, "package.json"),
    '{ "name": "test-app", "version": "1.0.0" }\n'
  );

  execSync("git add -A && git commit -m 'initial'", { cwd: dir, stdio: "ignore" });
  return dir;
}

describe("E2E Integration", () => {
  let repoDir: string;

  beforeEach(() => {
    repoDir = createTempRepo();
  });

  it("full pipeline: agent mutation → diff → command → ledger → reset", async () => {
    const outputDir = join(repoDir, ".agenteval");

    // ── Step 1: Simulate agent mutating files ──
    writeFileSync(
      join(repoDir, "src", "hello.ts"),
      'export function hello() {\n  return "Hello World";\n}\n\nexport function goodbye() {\n  return "Goodbye";\n}\n'
    );

    // ── Step 2: Capture diff via EvalContext ──
    const ctx = new EvalContext(repoDir);
    ctx.storeDiff();

    expect(ctx.diff).toBeTruthy();
    expect(ctx.diff).toContain("goodbye");
    expect(ctx.diff).toContain("+export function goodbye");

    // ── Step 3: Run a command in context ──
    const result = await ctx.runCommand("echo-test", "echo 'tests passed'");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("tests passed");
    expect(ctx.commands).toHaveLength(1);

    // ── Step 4: Write to SQLite ledger (simulated judge result) ──
    const entry: LedgerEntry = {
      testId: "e2e-add-goodbye",
      timestamp: new Date().toISOString(),
      agentRunner: "mock-agent",
      judgeModel: "claude-sonnet-4-20250514",
      score: 0.95,
      pass: true,
      reason: "The agent correctly added a `goodbye` function with proper TypeScript syntax.",
      context: {
        diff: ctx.diff,
        commands: ctx.commands,
      },
      durationMs: 1234,
    };

    appendLedgerEntry(outputDir, entry);

    // ── Step 5: Verify ledger contains the data ──
    const entries = readLedger(outputDir);
    expect(entries).toHaveLength(1);
    expect(entries[0].testId).toBe("e2e-add-goodbye");
    expect(entries[0].score).toBe(0.95);
    expect(entries[0].pass).toBe(true);
    expect(entries[0].agentRunner).toBe("mock-agent");
    expect(entries[0].reason).toContain("goodbye");
    expect(entries[0].context.diff).toContain("+export function goodbye");
    expect(entries[0].context.commands).toHaveLength(1);
    expect(entries[0].context.commands[0].stdout).toContain("tests passed");

    // ── Step 6: Verify git reset restores pristine state ──
    gitResetHard(repoDir);

    const fileContent = readFileSync(join(repoDir, "src", "hello.ts"), "utf-8");
    expect(fileContent).not.toContain("goodbye");
    expect(fileContent).toContain("Hello World");

    const diffAfterReset = gitDiff(repoDir);
    expect(diffAfterReset).toBe("");
  });

  it("multiple runs accumulate in the ledger", async () => {
    const outputDir = join(repoDir, ".agenteval");

    for (let i = 0; i < 3; i++) {
      const entry: LedgerEntry = {
        testId: `e2e-multi-${i}`,
        timestamp: new Date().toISOString(),
        agentRunner: i % 2 === 0 ? "agent-a" : "agent-b",
        judgeModel: "gpt-4o",
        score: 0.7 + i * 0.1,
        pass: i >= 1,
        reason: `Run ${i} evaluation`,
        context: { diff: `diff-${i}`, commands: [] },
        durationMs: 100 * (i + 1),
      };
      appendLedgerEntry(outputDir, entry);
    }

    const entries = readLedger(outputDir);
    expect(entries).toHaveLength(3);
    expect(entries[0].testId).toBe("e2e-multi-0");
    expect(entries[2].testId).toBe("e2e-multi-2");
    expect(entries[0].pass).toBe(false);
    expect(entries[2].pass).toBe(true);
  });

  it("context.logs formats diff + commands together", async () => {
    writeFileSync(
      join(repoDir, "src", "hello.ts"),
      'export function hello() {\n  return "Changed";\n}\n'
    );

    const ctx = new EvalContext(repoDir);
    ctx.storeDiff();
    await ctx.runCommand("lint", "echo 'no errors'");
    await ctx.runCommand("test", "echo 'all passed'");

    const logs = ctx.logs;
    expect(logs).toContain("── Git Diff ──");
    expect(logs).toContain("Changed");
    expect(logs).toContain("── lint");
    expect(logs).toContain("── test");
    expect(logs).toContain("no errors");
    expect(logs).toContain("all passed");
  });

  it("git reset removes untracked files created by agent", () => {
    // Agent creates a new file
    writeFileSync(join(repoDir, "src", "new-feature.ts"), "export const x = 1;");
    expect(existsSync(join(repoDir, "src", "new-feature.ts"))).toBe(true);

    gitResetHard(repoDir);

    expect(existsSync(join(repoDir, "src", "new-feature.ts"))).toBe(false);
  });
});
