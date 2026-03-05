import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  appendLedgerEntry,
  readLedger,
  readLedgerByTestId,
  getTestIds,
  getTestTree,
  getLatestEntries,
  getRunnerStats,
  overrideRunScore,
  getRunOverrides,
  getAllRunnerStats,
} from "./ledger.js";
import type { LedgerEntry, TaskResult } from "../core/types.js";
import { DEFAULT_THRESHOLDS, computeStatus } from "../core/types.js";

function makeTmpDir(): string {
  const dir = join(tmpdir(), `agenteval-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function makeEntry(overrides: Partial<LedgerEntry> = {}): LedgerEntry {
  const score = overrides.score ?? 0.85;
  const thresholds = overrides.thresholds ?? DEFAULT_THRESHOLDS;
  const status = overrides.status ?? computeStatus(score, thresholds);
  return {
    testId: "test-1",
    suitePath: [],
    timestamp: new Date().toISOString(),
    agentRunner: "mock-runner",
    judgeModel: "mock-model",
    score,
    pass: status !== "FAIL",
    status,
    reason: "Looks good",
    improvement: "No improvement needed.",
    diff: null,
    changedFiles: [],
    commands: [],
    taskResults: [],
    timing: { totalMs: 1000 },
    logs: "",
    criteria: "test criteria",
    durationMs: 1000,
    thresholds,
    ...overrides,
  };
}

describe("ledger (SQLite)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty array when database does not exist yet", () => {
    const entries = readLedger(tmpDir);
    expect(entries).toEqual([]);
  });

  it("appends and reads a single entry", () => {
    const entry = makeEntry();
    appendLedgerEntry(tmpDir, entry);

    const entries = readLedger(tmpDir);
    expect(entries).toHaveLength(1);
    expect(entries[0].testId).toBe("test-1");
    expect(entries[0].score).toBe(0.85);
    expect(entries[0].status).toBe("PASS");
    expect(entries[0].thresholds).toEqual({ warn: 0.8, fail: 0.5 });
  });

  it("stores WARN status for score between thresholds", () => {
    appendLedgerEntry(tmpDir, makeEntry({ score: 0.65 }));
    const entries = readLedger(tmpDir);
    expect(entries[0].status).toBe("WARN");
    expect(entries[0].pass).toBe(true);
  });

  it("stores FAIL status for score below fail threshold", () => {
    appendLedgerEntry(tmpDir, makeEntry({ score: 0.3 }));
    const entries = readLedger(tmpDir);
    expect(entries[0].status).toBe("FAIL");
    expect(entries[0].pass).toBe(false);
  });

  it("preserves custom thresholds", () => {
    const custom = { warn: 0.9, fail: 0.7 };
    appendLedgerEntry(tmpDir, makeEntry({ score: 0.75, thresholds: custom }));
    const entries = readLedger(tmpDir);
    expect(entries[0].status).toBe("WARN");
    expect(entries[0].thresholds).toEqual(custom);
  });

  it("appends multiple entries as separate rows", () => {
    appendLedgerEntry(tmpDir, makeEntry({ testId: "a" }));
    appendLedgerEntry(tmpDir, makeEntry({ testId: "b" }));
    appendLedgerEntry(tmpDir, makeEntry({ testId: "c" }));

    const entries = readLedger(tmpDir);
    expect(entries).toHaveLength(3);

    // Verify SQLite file exists
    expect(existsSync(join(tmpDir, "ledger.sqlite"))).toBe(true);
  });

  it("filters entries by test ID", () => {
    appendLedgerEntry(tmpDir, makeEntry({ testId: "banner" }));
    appendLedgerEntry(tmpDir, makeEntry({ testId: "search" }));
    appendLedgerEntry(tmpDir, makeEntry({ testId: "banner" }));

    const bannerEntries = readLedgerByTestId(tmpDir, "banner");
    expect(bannerEntries).toHaveLength(2);

    const searchEntries = readLedgerByTestId(tmpDir, "search");
    expect(searchEntries).toHaveLength(1);
  });

  it("returns unique test IDs sorted alphabetically", () => {
    appendLedgerEntry(tmpDir, makeEntry({ testId: "a" }));
    appendLedgerEntry(tmpDir, makeEntry({ testId: "b" }));
    appendLedgerEntry(tmpDir, makeEntry({ testId: "a" }));

    const ids = getTestIds(tmpDir);
    expect(ids).toEqual(["a", "b"]);
  });

  it("returns latest entry per test ID", () => {
    appendLedgerEntry(
      tmpDir,
      makeEntry({ testId: "a", score: 0.5, timestamp: "2025-01-01T00:00:00Z" }),
    );
    appendLedgerEntry(
      tmpDir,
      makeEntry({ testId: "a", score: 0.9, timestamp: "2025-01-02T00:00:00Z" }),
    );
    appendLedgerEntry(
      tmpDir,
      makeEntry({ testId: "b", score: 0.7, timestamp: "2025-01-01T00:00:00Z" }),
    );

    const latest = getLatestEntries(tmpDir);
    expect(latest.size).toBe(2);
    expect(latest.get("a")!.score).toBe(0.9);
    expect(latest.get("b")!.score).toBe(0.7);
  });

  it("preserves command results through JSON serialization", () => {
    const entry = makeEntry({
      diff: "--- a/file.ts\n+++ b/file.ts",
      commands: [
        {
          name: "vitest",
          command: "npx vitest run",
          stdout: "Tests: 5 passed",
          stderr: "",
          exitCode: 0,
          durationMs: 2000,
        },
      ],
    });
    appendLedgerEntry(tmpDir, entry);

    const entries = readLedger(tmpDir);
    expect(entries[0].diff).toBe("--- a/file.ts\n+++ b/file.ts");
    expect(entries[0].commands).toHaveLength(1);
    expect(entries[0].commands[0].name).toBe("vitest");
    expect(entries[0].commands[0].stdout).toBe("Tests: 5 passed");
  });

  it("computes runner stats with aggregates", () => {
    appendLedgerEntry(tmpDir, makeEntry({ testId: "x", agentRunner: "copilot", score: 0.8 }));
    appendLedgerEntry(tmpDir, makeEntry({ testId: "x", agentRunner: "copilot", score: 0.6 }));
    appendLedgerEntry(tmpDir, makeEntry({ testId: "x", agentRunner: "cursor", score: 0.9 }));

    const stats = getRunnerStats(tmpDir, "x");
    expect(stats).toHaveLength(2);

    const cursor = stats.find((s) => s.agentRunner === "cursor")!;
    expect(cursor.avgScore).toBe(0.9);
    expect(cursor.totalRuns).toBe(1);
    expect(cursor.passRate).toBe(1.0);

    const copilot = stats.find((s) => s.agentRunner === "copilot")!;
    expect(copilot.avgScore).toBeCloseTo(0.7);
    expect(copilot.totalRuns).toBe(2);
    // 0.8 → PASS, 0.6 → WARN (both pass=true with default thresholds)
    expect(copilot.passRate).toBe(1.0);
  });

  it("stores and retrieves suitePath as JSON", () => {
    appendLedgerEntry(
      tmpDir,
      makeEntry({ testId: "nested", suitePath: ["UI Components", "Banner"] }),
    );

    const entries = readLedger(tmpDir);
    expect(entries).toHaveLength(1);
    expect(entries[0].suitePath).toEqual(["UI Components", "Banner"]);
  });

  it("defaults suitePath to empty array for entries without it", () => {
    appendLedgerEntry(tmpDir, makeEntry({ testId: "simple" }));

    const entries = readLedger(tmpDir);
    expect(entries[0].suitePath).toEqual([]);
  });

  it("getTestTree returns flat list for tests without suitePath", () => {
    appendLedgerEntry(tmpDir, makeEntry({ testId: "test-a" }));
    appendLedgerEntry(tmpDir, makeEntry({ testId: "test-b" }));

    const tree = getTestTree(tmpDir);
    expect(tree).toEqual([
      { name: "test-a", type: "test", testId: "test-a" },
      { name: "test-b", type: "test", testId: "test-b" },
    ]);
  });

  it("getTestTree builds hierarchical structure from suitePaths", () => {
    appendLedgerEntry(
      tmpDir,
      makeEntry({ testId: "Add close button", suitePath: ["UI", "Banner"] }),
    );
    appendLedgerEntry(tmpDir, makeEntry({ testId: "Add search", suitePath: ["UI", "Search"] }));
    appendLedgerEntry(tmpDir, makeEntry({ testId: "standalone" }));

    const tree = getTestTree(tmpDir);
    expect(tree).toHaveLength(2); // "UI" suite + "standalone" test

    const uiSuite = tree.find((n) => n.name === "UI");
    expect(uiSuite).toBeDefined();
    expect(uiSuite!.type).toBe("suite");
    expect(uiSuite!.children).toHaveLength(2); // Banner + Search

    const bannerSuite = uiSuite!.children!.find((n) => n.name === "Banner");
    expect(bannerSuite!.type).toBe("suite");
    expect(bannerSuite!.children).toHaveLength(1);
    expect(bannerSuite!.children![0].testId).toBe("Add close button");

    const standalone = tree.find((n) => n.name === "standalone");
    expect(standalone!.type).toBe("test");
    expect(standalone!.testId).toBe("standalone");
  });

  // ─── Score Override Tests ───

  it("overrideRunScore inserts an override and returns it", () => {
    appendLedgerEntry(tmpDir, makeEntry({ testId: "x", score: 0.3 }));
    const entries = readLedger(tmpDir);
    const runId = entries[0].id!;

    const override = overrideRunScore(tmpDir, runId, 0.8, "Reviewer re-evaluated");
    expect(override.score).toBe(0.8);
    expect(override.pass).toBe(true);
    expect(override.status).toBe("PASS");
    expect(override.reason).toBe("Reviewer re-evaluated");
    expect(override.timestamp).toBeTruthy();
  });

  it("overrideRunScore throws for invalid score", () => {
    appendLedgerEntry(tmpDir, makeEntry({ testId: "x" }));
    const entries = readLedger(tmpDir);
    const runId = entries[0].id!;

    expect(() => overrideRunScore(tmpDir, runId, 1.5, "reason")).toThrow("between 0 and 1");
    expect(() => overrideRunScore(tmpDir, runId, -0.1, "reason")).toThrow("between 0 and 1");
  });

  it("overrideRunScore throws for empty reason", () => {
    appendLedgerEntry(tmpDir, makeEntry({ testId: "x" }));
    const entries = readLedger(tmpDir);
    const runId = entries[0].id!;

    expect(() => overrideRunScore(tmpDir, runId, 0.5, "")).toThrow("Reason is required");
    expect(() => overrideRunScore(tmpDir, runId, 0.5, "   ")).toThrow("Reason is required");
  });

  it("overrideRunScore throws for non-existent run", () => {
    // Create DB but no matching run
    readLedger(tmpDir);
    expect(() => overrideRunScore(tmpDir, 999, 0.5, "reason")).toThrow("not found");
  });

  it("getRunOverrides returns latest override", () => {
    appendLedgerEntry(tmpDir, makeEntry({ testId: "x" }));
    const entries = readLedger(tmpDir);
    const runId = entries[0].id!;

    overrideRunScore(tmpDir, runId, 0.6, "First override");
    overrideRunScore(tmpDir, runId, 0.9, "Second override");

    const overrides = getRunOverrides(tmpDir, runId);
    expect(overrides).toHaveLength(1);
    expect(overrides[0].reason).toBe("Second override");
    expect(overrides[0].score).toBe(0.9);
  });

  it("readLedger includes latest override on entries", () => {
    appendLedgerEntry(tmpDir, makeEntry({ testId: "x", score: 0.3 }));
    const entries = readLedger(tmpDir);
    const runId = entries[0].id!;

    overrideRunScore(tmpDir, runId, 0.85, "Manual review");

    const updated = readLedger(tmpDir);
    expect(updated[0].override).toBeDefined();
    expect(updated[0].override!.score).toBe(0.85);
    expect(updated[0].override!.pass).toBe(true);
    expect(updated[0].override!.status).toBe("PASS");
    expect(updated[0].override!.reason).toBe("Manual review");
  });

  it("readLedger returns no override when none exists", () => {
    appendLedgerEntry(tmpDir, makeEntry({ testId: "x" }));
    const entries = readLedger(tmpDir);
    expect(entries[0].override).toBeUndefined();
  });

  it("aggregation queries use override score when present", () => {
    appendLedgerEntry(tmpDir, makeEntry({ testId: "x", agentRunner: "copilot", score: 0.3 }));
    appendLedgerEntry(tmpDir, makeEntry({ testId: "x", agentRunner: "copilot", score: 0.4 }));
    const entries = readLedger(tmpDir);

    // Override first run's score from 0.3 → 0.9
    overrideRunScore(tmpDir, entries[0].id!, 0.9, "Better than expected");

    const stats = getRunnerStats(tmpDir, "x");
    const copilot = stats.find((s) => s.agentRunner === "copilot")!;
    // Average should be (0.9 + 0.4) / 2 = 0.65 instead of (0.3 + 0.4) / 2 = 0.35
    expect(copilot.avgScore).toBeCloseTo(0.65);
  });

  it("getAllRunnerStats uses override scores", () => {
    appendLedgerEntry(tmpDir, makeEntry({ testId: "a", agentRunner: "cursor", score: 0.2 }));
    const entries = readLedger(tmpDir);

    overrideRunScore(tmpDir, entries[0].id!, 0.8, "Adjusted");

    const stats = getAllRunnerStats(tmpDir);
    const cursor = stats.find((s) => s.agentRunner === "cursor")!;
    expect(cursor.avgScore).toBeCloseTo(0.8);
    expect(cursor.passRate).toBe(1.0); // override pass = true (0.8 >= 0.5)
  });

  it("rowToEntry handles null commands gracefully", () => {
    // Insert a row with null commands directly
    appendLedgerEntry(tmpDir, makeEntry({ commands: [] }));
    const entries = readLedger(tmpDir);
    expect(entries[0].commands).toEqual([]);
  });

  it("handles entries with null diff", () => {
    appendLedgerEntry(tmpDir, makeEntry({ diff: null }));
    const entries = readLedger(tmpDir);
    expect(entries[0].diff).toBeNull();
  });

  it("getLatestEntries returns no override when none exists", () => {
    appendLedgerEntry(tmpDir, makeEntry({ testId: "no-override" }));
    const latest = getLatestEntries(tmpDir);
    const entry = latest.get("no-override");
    expect(entry).toBeDefined();
    expect(entry!.override).toBeUndefined();
  });

  it("override with WARN status computed correctly", () => {
    appendLedgerEntry(tmpDir, makeEntry({ testId: "x", score: 0.3 }));
    const entries = readLedger(tmpDir);
    const runId = entries[0].id!;

    const override = overrideRunScore(tmpDir, runId, 0.65, "Partial improvement");
    expect(override.status).toBe("WARN");
    expect(override.pass).toBe(true);
  });

  it("getAllRunnerStats returns empty for no data", () => {
    // Just open the DB by reading (creates schema) but don't insert anything
    readLedger(tmpDir);
    const stats = getAllRunnerStats(tmpDir);
    expect(stats).toEqual([]);
  });

  it("getRunOverrides returns empty for no overrides", () => {
    appendLedgerEntry(tmpDir, makeEntry({ testId: "x" }));
    const entries = readLedger(tmpDir);
    const overrides = getRunOverrides(tmpDir, entries[0].id!);
    expect(overrides).toEqual([]);
  });

  // ─── New columns: tokens, timing, tasks, etc. ───

  it("stores and retrieves token usage data", () => {
    const agentTokens = { inputTokens: 1500, outputTokens: 800, totalTokens: 2300 };
    const judgeTokens = { inputTokens: 2200, outputTokens: 350, totalTokens: 2550 };
    appendLedgerEntry(
      tmpDir,
      makeEntry({ agentTokenUsage: agentTokens, judgeTokenUsage: judgeTokens }),
    );

    const entries = readLedger(tmpDir);
    expect(entries[0].agentTokenUsage).toEqual(agentTokens);
    expect(entries[0].judgeTokenUsage).toEqual(judgeTokens);
  });

  it("handles missing token usage gracefully", () => {
    appendLedgerEntry(tmpDir, makeEntry({}));
    const entries = readLedger(tmpDir);
    expect(entries[0].agentTokenUsage).toBeUndefined();
    expect(entries[0].judgeTokenUsage).toBeUndefined();
  });

  it("stores and retrieves timing breakdown", () => {
    const timing = {
      totalMs: 45000,
      setupMs: 500,
      agentMs: 30000,
      tasksMs: 7000,
      judgeMs: 7300,
    };
    appendLedgerEntry(tmpDir, makeEntry({ timing }));

    const entries = readLedger(tmpDir);
    expect(entries[0].timing).toEqual(timing);
  });

  it("stores and retrieves task results", () => {
    const taskResults = [
      {
        task: {
          name: "unit tests",
          criteria: "All tests pass",
          weight: 2,
          action: () => ({
            name: "unit tests",
            command: "pnpm test",
            stdout: "",
            stderr: "",
            exitCode: 0,
            durationMs: 0,
          }),
        },
        result: {
          name: "unit tests",
          command: "pnpm test",
          stdout: "OK",
          stderr: "",
          exitCode: 0,
          durationMs: 3000,
        },
      },
    ] as TaskResult[];
    appendLedgerEntry(tmpDir, makeEntry({ taskResults }));

    const entries = readLedger(tmpDir);
    // action function is not serializable — only data fields survive JSON round-trip
    expect(entries[0].taskResults).toEqual([
      {
        task: { name: "unit tests", criteria: "All tests pass", weight: 2 },
        result: {
          name: "unit tests",
          command: "pnpm test",
          stdout: "OK",
          stderr: "",
          exitCode: 0,
          durationMs: 3000,
        },
      },
    ]);
  });

  it("stores and retrieves changed files and expected files", () => {
    const changedFiles = ["src/Banner.tsx", "src/Banner.test.tsx"];
    const expectedFiles = ["src/Banner.tsx"];
    appendLedgerEntry(tmpDir, makeEntry({ changedFiles, expectedFiles }));

    const entries = readLedger(tmpDir);
    expect(entries[0].changedFiles).toEqual(changedFiles);
    expect(entries[0].expectedFiles).toEqual(expectedFiles);
  });

  it("stores instruction and criteria", () => {
    appendLedgerEntry(
      tmpDir,
      makeEntry({ instruction: "Add a close button", criteria: "Button must be accessible" }),
    );

    const entries = readLedger(tmpDir);
    expect(entries[0].instruction).toBe("Add a close button");
    expect(entries[0].criteria).toBe("Button must be accessible");
  });

  it("stores agent output", () => {
    appendLedgerEntry(tmpDir, makeEntry({ agentOutput: "I added the button as requested" }));
    const entries = readLedger(tmpDir);
    expect(entries[0].agentOutput).toBe("I added the button as requested");
  });
});
