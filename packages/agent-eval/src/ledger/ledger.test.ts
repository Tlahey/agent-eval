import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  appendLedgerEntry,
  readLedger,
  getRunnerStats,
  getTestTree,
  getTags,
  overrideScore,
} from "./ledger.js";
import type { LedgerEntry, Thresholds } from "../core/types.js";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("ledger (SQLite)", () => {
  let tmpDir: string;
  const thresholds: Thresholds = { warn: 0.8, fail: 0.5 };

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "agenteval-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  const makeEntry = (overrides: Partial<LedgerEntry> = {}): LedgerEntry => ({
    testId: "test-test",
    suitePath: [],
    timestamp: new Date().toISOString(),
    agentRunner: "mock-agent",
    instruction: "test instruction",
    diff: "test diff",
    changedFiles: ["file.ts"],
    commands: [],
    taskResults: [],
    timing: { totalMs: 100 },
    logs: "test logs",
    judgeModel: "gpt-4o",
    score: 0.9,
    pass: true,
    status: "PASS",
    reason: "good",
    improvement: "none",
    criteria: "be good",
    thresholds,
    durationMs: 100,
    ...overrides,
  });

  it("appends and reads entries", () => {
    const entry = makeEntry();
    appendLedgerEntry(tmpDir, entry);

    const entries = readLedger(tmpDir);
    expect(entries).toHaveLength(1);
    expect(entries[0].testId).toBe("test-test");
  });

  it("filters entries by test ID", () => {
    appendLedgerEntry(tmpDir, makeEntry({ testId: "a" }));
    appendLedgerEntry(tmpDir, makeEntry({ testId: "b" }));

    const all = readLedger(tmpDir);
    expect(all).toHaveLength(2);

    const stats = getRunnerStats(tmpDir, "a");
    expect(stats).toHaveLength(1);
  });

  it("returns unique test IDs from the tree", () => {
    appendLedgerEntry(tmpDir, makeEntry({ testId: "test-a" }));
    appendLedgerEntry(tmpDir, makeEntry({ testId: "test-b" }));

    const tree = getTestTree(tmpDir);
    expect(tree).toHaveLength(2);
    const names = tree.map((n) => n.name).sort();
    expect(names).toEqual(["test-a", "test-b"]);
  });

  it("getTestTree builds hierarchical structure from suitePaths", () => {
    appendLedgerEntry(tmpDir, makeEntry({ testId: "t1", suitePath: ["ui", "button"] }));
    appendLedgerEntry(tmpDir, makeEntry({ testId: "t2", suitePath: ["ui", "input"] }));

    const tree = getTestTree(tmpDir);
    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe("ui");
    expect(tree[0].type).toBe("suite");
    expect(tree[0].children).toHaveLength(2);
  });

  it("getTags returns unique tags sorted alphabetically", () => {
    appendLedgerEntry(tmpDir, makeEntry({ tags: ["b", "a"] }));
    appendLedgerEntry(tmpDir, makeEntry({ tags: ["a", "c"] }));

    const tags = getTags(tmpDir);
    expect(tags).toEqual(["a", "b", "c"]);
  });

  it("overrideScore inserts an override and returns it", () => {
    appendLedgerEntry(tmpDir, makeEntry());
    const entries = readLedger(tmpDir);
    const runId = entries[0].id!;

    const override = overrideScore(tmpDir, runId, 0.4, "Manual review");
    expect(override.score).toBe(0.4);
    expect(override.reason).toBe("Manual review");

    const updated = readLedger(tmpDir);
    expect(updated[0].override).toBeDefined();
    expect(updated[0].override!.score).toBe(0.4);
  });

  it("getRunnerStats computes averages and pass rates", () => {
    appendLedgerEntry(tmpDir, makeEntry({ agentRunner: "r1", score: 1.0, pass: true }));
    appendLedgerEntry(tmpDir, makeEntry({ agentRunner: "r1", score: 0.0, pass: false }));

    const stats = getRunnerStats(tmpDir);
    expect(stats).toHaveLength(1);
    expect(stats[0].agentRunner).toBe("r1");
    expect(stats[0].avgScore).toBe(0.5);
    expect(stats[0].passRate).toBe(0.5);
  });
});
