import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  appendLedgerEntry,
  readLedger,
  readLedgerByTestId,
  getTestIds,
  getLatestEntries,
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
    timestamp: new Date().toISOString(),
    agentRunner: "mock-runner",
    judgeModel: "mock-model",
    score: 0.85,
    pass: true,
    reason: "Looks good",
    context: { diff: null, commands: [] },
    durationMs: 1000,
    ...overrides,
  };
}

describe("ledger", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty array when ledger file does not exist", () => {
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

  it("appends multiple entries as separate lines", () => {
    appendLedgerEntry(tmpDir, makeEntry({ testId: "a" }));
    appendLedgerEntry(tmpDir, makeEntry({ testId: "b" }));
    appendLedgerEntry(tmpDir, makeEntry({ testId: "c" }));

    const entries = readLedger(tmpDir);
    expect(entries).toHaveLength(3);

    // Verify JSONL format (one JSON per line)
    const raw = readFileSync(join(tmpDir, "ledger.jsonl"), "utf-8");
    const lines = raw.split("\n").filter((l) => l.trim());
    expect(lines).toHaveLength(3);
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

  it("returns unique test IDs", () => {
    appendLedgerEntry(tmpDir, makeEntry({ testId: "a" }));
    appendLedgerEntry(tmpDir, makeEntry({ testId: "b" }));
    appendLedgerEntry(tmpDir, makeEntry({ testId: "a" }));

    const ids = getTestIds(tmpDir);
    expect(ids).toEqual(["a", "b"]);
  });

  it("returns latest entry per test ID", () => {
    appendLedgerEntry(tmpDir, makeEntry({ testId: "a", score: 0.5, timestamp: "2025-01-01T00:00:00Z" }));
    appendLedgerEntry(tmpDir, makeEntry({ testId: "a", score: 0.9, timestamp: "2025-01-02T00:00:00Z" }));
    appendLedgerEntry(tmpDir, makeEntry({ testId: "b", score: 0.7, timestamp: "2025-01-01T00:00:00Z" }));

    const latest = getLatestEntries(tmpDir);
    expect(latest.size).toBe(2);
    expect(latest.get("a")!.score).toBe(0.9);
    expect(latest.get("b")!.score).toBe(0.7);
  });

  it("handles empty lines in JSONL gracefully", () => {
    const filePath = join(tmpDir, "ledger.jsonl");
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(filePath, '{"testId":"x","timestamp":"","agentRunner":"r","judgeModel":"m","score":1,"pass":true,"reason":"","context":{"diff":null,"commands":[]},"durationMs":0}\n\n\n', "utf-8");

    const entries = readLedger(tmpDir);
    expect(entries).toHaveLength(1);
  });
});
