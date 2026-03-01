import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SqliteLedger } from "./sqlite.js";
import type { LedgerEntry } from "../../core/types.js";

function makeLedgerEntry(overrides?: Partial<LedgerEntry>): LedgerEntry {
  return {
    testId: "test-1",
    suitePath: [],
    timestamp: new Date().toISOString(),
    agentRunner: "copilot",
    judgeModel: "gpt-4",
    score: 0.85,
    pass: true,
    status: "PASS",
    reason: "Good implementation",
    improvement: "",
    diff: "diff --git a/file.txt",
    changedFiles: ["file.txt"],
    commands: [
      {
        name: "test",
        command: "pnpm test",
        stdout: "ok",
        stderr: "",
        exitCode: 0,
        durationMs: 100,
      },
    ],
    taskResults: [],
    timing: { totalMs: 1234 },
    logs: "",
    criteria: "test criteria",
    durationMs: 1234,
    thresholds: { warn: 0.8, fail: 0.5 },
    ...overrides,
  };
}

describe("SqliteLedger", () => {
  let tmpDir: string;
  let ledger: SqliteLedger;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "sqlite-ledger-"));
    ledger = new SqliteLedger({ outputDir: tmpDir });
    ledger.initialize();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("has name 'sqlite'", () => {
    expect(ledger.name).toBe("sqlite");
  });

  it("uses default outputDir when no options provided", () => {
    const defaultLedger = new SqliteLedger();
    expect(defaultLedger.name).toBe("sqlite");
  });

  it("records and retrieves a run", () => {
    const entry = makeLedgerEntry();
    ledger.recordRun(entry);

    const runs = ledger.getRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0].testId).toBe("test-1");
    expect(runs[0].score).toBe(0.85);
  });

  it("retrieves runs filtered by testId", () => {
    ledger.recordRun(makeLedgerEntry({ testId: "test-1" }));
    ledger.recordRun(makeLedgerEntry({ testId: "test-2" }));

    const filtered = ledger.getRuns("test-1");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].testId).toBe("test-1");
  });

  it("retrieves all runs when no testId filter", () => {
    ledger.recordRun(makeLedgerEntry({ testId: "test-1" }));
    ledger.recordRun(makeLedgerEntry({ testId: "test-2" }));

    const all = ledger.getRuns();
    expect(all).toHaveLength(2);
  });

  it("getRunById returns correct entry", () => {
    ledger.recordRun(makeLedgerEntry({ testId: "test-1" }));
    ledger.recordRun(makeLedgerEntry({ testId: "test-2" }));

    const entry = ledger.getRunById(1);
    expect(entry).toBeDefined();
    expect(entry?.testId).toBe("test-1");
  });

  it("getRunById returns undefined for invalid id", () => {
    expect(ledger.getRunById(999)).toBeUndefined();
  });

  it("returns unique test IDs", () => {
    ledger.recordRun(makeLedgerEntry({ testId: "test-1" }));
    ledger.recordRun(makeLedgerEntry({ testId: "test-2" }));
    ledger.recordRun(makeLedgerEntry({ testId: "test-1" }));

    const ids = ledger.getTestIds();
    expect(ids).toContain("test-1");
    expect(ids).toContain("test-2");
    expect(ids).toHaveLength(2);
  });

  it("builds a test tree from suite paths", () => {
    ledger.recordRun(makeLedgerEntry({ testId: "Add button", suitePath: ["UI", "Banner"] }));
    ledger.recordRun(makeLedgerEntry({ testId: "Fix header", suitePath: ["UI"] }));

    const tree = ledger.getTestTree();
    expect(tree.length).toBeGreaterThan(0);
    const uiNode = tree.find((n) => n.name === "UI");
    expect(uiNode).toBeDefined();
    expect(uiNode?.type).toBe("suite");
  });

  it("getLatestEntries returns latest per test", () => {
    ledger.recordRun(makeLedgerEntry({ testId: "test-1", score: 0.5 }));
    ledger.recordRun(makeLedgerEntry({ testId: "test-1", score: 0.9 }));
    ledger.recordRun(makeLedgerEntry({ testId: "test-2", score: 0.7 }));

    const latest = ledger.getLatestEntries();
    expect(latest.size).toBe(2);
  });

  it("getStats returns aggregate stats", () => {
    ledger.recordRun(makeLedgerEntry({ agentRunner: "copilot", score: 0.8, pass: true }));
    ledger.recordRun(makeLedgerEntry({ agentRunner: "copilot", score: 0.4, pass: false }));

    const stats = ledger.getStats();
    expect(stats).toHaveLength(1);
    expect(stats[0].agentRunner).toBe("copilot");
    expect(stats[0].totalRuns).toBe(2);
  });

  it("getStats with testId filters correctly", () => {
    ledger.recordRun(makeLedgerEntry({ testId: "test-1", agentRunner: "copilot" }));
    ledger.recordRun(makeLedgerEntry({ testId: "test-2", agentRunner: "copilot" }));

    const stats = ledger.getStats("test-1");
    expect(stats).toHaveLength(1);
    expect(stats[0].totalRuns).toBe(1);
  });

  it("overrides a run score", () => {
    ledger.recordRun(makeLedgerEntry({ score: 0.5 }));

    const override = ledger.overrideRunScore(1, 0.9, "Manual correction");
    expect(override.score).toBe(0.9);
    expect(override.reason).toBe("Manual correction");
  });

  it("getRunOverrides returns override history", () => {
    ledger.recordRun(makeLedgerEntry({ score: 0.5 }));
    ledger.overrideRunScore(1, 0.8, "First override");
    ledger.overrideRunScore(1, 0.9, "Second override");

    const overrides = ledger.getRunOverrides(1);
    expect(overrides).toHaveLength(2);
  });

  it("returns empty results for empty ledger", () => {
    expect(ledger.getRuns()).toEqual([]);
    expect(ledger.getTestIds()).toEqual([]);
    expect(ledger.getTestTree()).toEqual([]);
    expect(ledger.getStats()).toEqual([]);
  });
});
