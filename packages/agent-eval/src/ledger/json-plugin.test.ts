import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { JsonLedger } from "./json-plugin.js";
import type { LedgerEntry } from "../core/types.js";

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
    context: { diff: "diff content", commands: [] },
    durationMs: 1234,
    thresholds: { pass: 0.7, warn: 0.5 },
    ...overrides,
  };
}

describe("JsonLedger", () => {
  let tmpDir: string;
  let ledger: JsonLedger;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "json-ledger-"));
    ledger = new JsonLedger({ outputDir: tmpDir });
    ledger.initialize();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates output directory on initialize", () => {
    expect(existsSync(tmpDir)).toBe(true);
  });

  it("records and retrieves a run", () => {
    const entry = makeLedgerEntry();
    ledger.recordRun(entry);
    const runs = ledger.getRuns() as LedgerEntry[];
    expect(runs).toHaveLength(1);
    expect(runs[0].testId).toBe("test-1");
  });

  it("filters runs by testId", () => {
    ledger.recordRun(makeLedgerEntry({ testId: "test-1" }));
    ledger.recordRun(makeLedgerEntry({ testId: "test-2" }));

    const filtered = ledger.getRuns("test-1") as LedgerEntry[];
    expect(filtered).toHaveLength(1);
    expect(filtered[0].testId).toBe("test-1");
  });

  it("returns unique test IDs", () => {
    ledger.recordRun(makeLedgerEntry({ testId: "test-1" }));
    ledger.recordRun(makeLedgerEntry({ testId: "test-2" }));
    ledger.recordRun(makeLedgerEntry({ testId: "test-1" }));

    const ids = ledger.getTestIds();
    expect(ids).toEqual(["test-1", "test-2"]);
  });

  it("builds a test tree from suite paths", () => {
    ledger.recordRun(makeLedgerEntry({ testId: "Add button", suitePath: ["UI", "Banner"] }));
    ledger.recordRun(makeLedgerEntry({ testId: "Fix header", suitePath: ["UI"] }));

    const tree = ledger.getTestTree();
    expect(tree).toHaveLength(1); // "UI" suite
    expect(tree[0].name).toBe("UI");
    expect(tree[0].type).toBe("suite");
  });

  it("computes runner stats", () => {
    ledger.recordRun(makeLedgerEntry({ agentRunner: "copilot", score: 0.8, pass: true }));
    ledger.recordRun(makeLedgerEntry({ agentRunner: "copilot", score: 0.6, pass: false }));

    const stats = ledger.getStats();
    expect(stats).toHaveLength(1);
    expect(stats[0].agentRunner).toBe("copilot");
    expect(stats[0].totalRuns).toBe(2);
    expect(stats[0].avgScore).toBeCloseTo(0.7);
    expect(stats[0].passRate).toBe(0.5);
  });

  it("overrides a run score and tracks history", () => {
    ledger.recordRun(makeLedgerEntry({ score: 0.5 }));

    const override = ledger.overrideRunScore(1, 0.9, "Manual correction");
    expect(override.score).toBe(0.9);
    expect(override.reason).toBe("Manual correction");
    expect(override.pass).toBe(true);

    const overrides = ledger.getRunOverrides(1);
    expect(overrides).toHaveLength(1);
  });

  it("getLatestEntries returns one entry per test", () => {
    ledger.recordRun(makeLedgerEntry({ testId: "test-1", score: 0.5 }));
    ledger.recordRun(makeLedgerEntry({ testId: "test-1", score: 0.9 }));
    ledger.recordRun(makeLedgerEntry({ testId: "test-2", score: 0.7 }));

    const latest = ledger.getLatestEntries();
    expect(latest.size).toBe(2);
    expect(latest.get("test-1")?.score).toBe(0.9);
    expect(latest.get("test-2")?.score).toBe(0.7);
  });

  it("persists data to disk as JSONL", () => {
    ledger.recordRun(makeLedgerEntry());
    const raw = readFileSync(join(tmpDir, "ledger.jsonl"), "utf-8");
    const lines = raw.trim().split("\n");
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]).testId).toBe("test-1");
  });

  it("returns empty results for empty ledger", () => {
    expect(ledger.getRuns()).toEqual([]);
    expect(ledger.getTestIds()).toEqual([]);
    expect(ledger.getTestTree()).toEqual([]);
    expect(ledger.getStats()).toEqual([]);
  });

  it("getRunById returns correct entry by id", () => {
    ledger.recordRun(makeLedgerEntry({ testId: "test-1" }));
    ledger.recordRun(makeLedgerEntry({ testId: "test-2" }));

    const entry = ledger.getRunById(2);
    expect(entry?.testId).toBe("test-2");
  });

  it("getRunById returns undefined for invalid id", () => {
    expect(ledger.getRunById(99)).toBeUndefined();
  });
});
