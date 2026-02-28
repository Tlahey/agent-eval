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
} from "./ledger.js";
import type { LedgerEntry } from "../core/types.js";

function makeTmpDir(): string {
  const dir = join(tmpdir(), `agenteval-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function makeEntry(overrides: Partial<LedgerEntry> = {}): LedgerEntry {
  return {
    testId: "test-1",
    suitePath: [],
    timestamp: new Date().toISOString(),
    agentRunner: "mock-runner",
    judgeModel: "mock-model",
    score: 0.85,
    pass: true,
    reason: "Looks good",
    improvement: "No improvement needed.",
    context: { diff: null, commands: [] },
    durationMs: 1000,
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
      context: {
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
      },
    });
    appendLedgerEntry(tmpDir, entry);

    const entries = readLedger(tmpDir);
    expect(entries[0].context.diff).toBe("--- a/file.ts\n+++ b/file.ts");
    expect(entries[0].context.commands).toHaveLength(1);
    expect(entries[0].context.commands[0].name).toBe("vitest");
    expect(entries[0].context.commands[0].stdout).toBe("Tests: 5 passed");
  });

  it("computes runner stats with aggregates", () => {
    appendLedgerEntry(
      tmpDir,
      makeEntry({ testId: "x", agentRunner: "copilot", score: 0.8, pass: true }),
    );
    appendLedgerEntry(
      tmpDir,
      makeEntry({ testId: "x", agentRunner: "copilot", score: 0.6, pass: false }),
    );
    appendLedgerEntry(
      tmpDir,
      makeEntry({ testId: "x", agentRunner: "cursor", score: 0.9, pass: true }),
    );

    const stats = getRunnerStats(tmpDir, "x");
    expect(stats).toHaveLength(2);

    const cursor = stats.find((s) => s.agentRunner === "cursor")!;
    expect(cursor.avgScore).toBe(0.9);
    expect(cursor.totalRuns).toBe(1);
    expect(cursor.passRate).toBe(1.0);

    const copilot = stats.find((s) => s.agentRunner === "copilot")!;
    expect(copilot.avgScore).toBeCloseTo(0.7);
    expect(copilot.totalRuns).toBe(2);
    expect(copilot.passRate).toBe(0.5);
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
});
