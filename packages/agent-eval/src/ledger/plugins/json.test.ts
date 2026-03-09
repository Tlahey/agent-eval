import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { JsonLedger } from "./json.js";
import type { LedgerEntry } from "../../core/types.js";

describe("JsonLedger", () => {
  const outputDir = ".test-ledger-json";
  const filePath = join(process.cwd(), outputDir, "ledger.jsonl");
  let ledger: JsonLedger;

  const mockEntry: LedgerEntry = {
    testId: "test-1",
    suitePath: ["UI"],
    timestamp: new Date().toISOString(),
    agentRunner: "copilot",
    judgeModel: "gpt4",
    score: 0.9,
    pass: true,
    status: "PASS",
    reason: "good",
    improvement: "",
    diff: "diff",
    changedFiles: ["file.ts"],
    commands: [],
    taskResults: [],
    timing: { totalMs: 1000, agentMs: 800, judgeMs: 200 },
    logs: "logs",
    criteria: "criteria",
    thresholds: { warn: 0.8, fail: 0.5 },
    durationMs: 1000,
  };

  beforeEach(async () => {
    ledger = new JsonLedger({ outputDir });
    await ledger.initialize();
  });

  afterEach(() => {
    rmSync(outputDir, { recursive: true, force: true });
  });

  it("records a run to a JSONL file", async () => {
    await ledger.recordRun(mockEntry);
    expect(existsSync(filePath)).toBe(true);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain('"testId":"test-1"');
  });

  it("retrieves all runs", async () => {
    await ledger.recordRun(mockEntry);
    await ledger.recordRun({ ...mockEntry, testId: "test-2" });
    const runs = await ledger.getRuns();
    expect(runs).toHaveLength(2);
  });

  it("filters runs by testId", async () => {
    await ledger.recordRun(mockEntry);
    await ledger.recordRun({ ...mockEntry, testId: "test-2" });
    const filtered = await ledger.getRuns("test-1");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].testId).toBe("test-1");
  });

  it("returns unique test IDs", async () => {
    await ledger.recordRun(mockEntry);
    await ledger.recordRun(mockEntry);
    await ledger.recordRun({ ...mockEntry, testId: "test-2" });
    const ids = await ledger.getTestIds();
    expect(ids).toEqual(["test-1", "test-2"]);
  });

  it("returns unique tags", async () => {
    await ledger.recordRun({ ...mockEntry, tags: ["tag1", "tag2"] });
    await ledger.recordRun({ ...mockEntry, tags: ["tag2", "tag3"] });
    const tags = await ledger.getTags();
    expect(tags).toEqual(["tag1", "tag2", "tag3"]);
  });

  it("builds a test tree", async () => {
    await ledger.recordRun(mockEntry);
    const tree = await ledger.getTestTree();
    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe("UI");
    expect(tree[0].type).toBe("suite");
  });

  it("calculates runner stats", async () => {
    await ledger.recordRun({ ...mockEntry, score: 0.9, pass: true, status: "PASS" });
    await ledger.recordRun({ ...mockEntry, score: 0.5, pass: true, status: "WARN" });
    const stats = await ledger.getStats();
    expect(stats).toHaveLength(1);
    expect(stats[0].agentRunner).toBe("copilot");
    expect(stats[0].totalRuns).toBe(2);
    expect(stats[0].avgScore).toBeCloseTo(0.7);
    expect(stats[0].passRate).toBe(1.0);
  });

  it("overrides a run score", async () => {
    await ledger.recordRun(mockEntry);
    const override = await ledger.overrideRunScore(1, 0.9, "Manual correction");
    expect(override.score).toBe(0.9);
    expect(override.reason).toBe("Manual correction");

    const runs = await ledger.getRuns();
    expect(runs[0].override?.score).toBe(0.9);
  });

  it("returns latest entries per test", async () => {
    await ledger.recordRun({ ...mockEntry, testId: "test-1", score: 0.5 });
    await ledger.recordRun({ ...mockEntry, testId: "test-1", score: 0.9 });
    await ledger.recordRun({ ...mockEntry, testId: "test-2", score: 0.7 });

    const latest = await ledger.getLatestEntries();
    expect(latest.size).toBe(2);
    expect(latest.get("test-1")?.score).toBe(0.9);
    expect(latest.get("test-2")?.score).toBe(0.7);
  });

  it("returns empty array if file does not exist", async () => {
    const runs = await ledger.getRuns();
    expect(runs).toEqual([]);
  });

  it("returns undefined if run ID not found", async () => {
    const entry = await ledger.getRunById(999);
    expect(entry).toBeUndefined();
  });

  it("retrieves a run by ID (1-based index)", async () => {
    await ledger.recordRun({ ...mockEntry, testId: "test-1" });
    await ledger.recordRun({ ...mockEntry, testId: "test-2" });
    const entry = await ledger.getRunById(2);
    expect(entry?.testId).toBe("test-2");
  });

  it("supports hierarchical tree with root tests", async () => {
    await ledger.recordRun({ ...mockEntry, testId: "root-test-1", suitePath: [] });
    await ledger.recordRun({ ...mockEntry, testId: "root-test-2", suitePath: [] });
    const tree = await ledger.getTestTree();
    expect(tree).toHaveLength(2);
    expect(tree[0].type).toBe("test");
    expect(tree[0].testId).toBe("root-test-1");
    expect(tree[1].testId).toBe("root-test-2");
  });

  it("persists overrides after restart", async () => {
    await ledger.recordRun(mockEntry);
    await ledger.overrideRunScore(1, 0.95, "New reason");

    const newLedger = new JsonLedger({ outputDir });
    const runs = (await newLedger.getRuns()) as LedgerEntry[];
    expect(runs[0].override?.score).toBe(0.95);
    expect(runs[0].override?.reason).toBe("New reason");
  });
});
