/**
 * SQLite Ledger Plugin wrapper.
 */

import {
  appendLedgerEntry,
  readLedger,
  getRunnerStats,
  getTestTree,
  getTags,
  overrideScore,
} from "../ledger.js";
import type { LedgerEntry, ScoreOverride } from "../../core/types.js";
import type { ILedgerPlugin, RunnerStats, TestTreeNode } from "../../core/interfaces.js";

export interface SqliteLedgerOptions {
  /** Directory where ledger.sqlite is stored (defaults to ".agenteval") */
  outputDir?: string;
}

export class SqliteLedger implements ILedgerPlugin {
  readonly name = "sqlite";
  private outputDir: string;

  constructor(options?: SqliteLedgerOptions) {
    this.outputDir = options?.outputDir ?? ".agenteval";
  }

  initialize(): void {
    // Schema is handled in openDb called by individual methods
  }

  recordRun(entry: LedgerEntry): void {
    appendLedgerEntry(this.outputDir, entry);
  }

  getRuns(testId?: string): LedgerEntry[] {
    const all = readLedger(this.outputDir);
    return testId ? all.filter((r) => r.testId === testId) : all;
  }

  getRunById(id: number): LedgerEntry | undefined {
    return readLedger(this.outputDir).find((r) => r.id === id);
  }

  getTestIds(): string[] {
    const runs = readLedger(this.outputDir);
    return [...new Set(runs.map((r) => r.testId))].sort();
  }

  getTags(): string[] {
    return getTags(this.outputDir);
  }

  getTestTree(): TestTreeNode[] {
    return getTestTree(this.outputDir);
  }

  getLatestEntries(): Map<string, LedgerEntry> {
    const runs = readLedger(this.outputDir);
    const result = new Map<string, LedgerEntry>();
    for (const run of runs) {
      const existing = result.get(run.testId);
      if (!existing || run.timestamp >= existing.timestamp) {
        result.set(run.testId, run);
      }
    }
    return result;
  }

  getStats(testId?: string): RunnerStats[] {
    return getRunnerStats(this.outputDir, testId);
  }

  overrideRunScore(runId: number, score: number, reason: string): ScoreOverride {
    return overrideScore(this.outputDir, runId, score, reason);
  }

  getRunOverrides(runId: number): ScoreOverride[] {
    const run = this.getRunById(runId);
    return run?.override ? [run.override] : [];
  }
}
