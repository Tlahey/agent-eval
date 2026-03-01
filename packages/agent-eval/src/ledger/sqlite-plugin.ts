/**
 * SQLite Ledger Plugin — wraps the existing ledger.ts functions
 * behind the ILedgerPlugin interface.
 *
 * This is the default ledger plugin when the user doesn't provide one.
 */

import type { LedgerEntry, ScoreOverride } from "../core/types.js";
import type { ILedgerPlugin, RunnerStats, TestTreeNode } from "../core/interfaces.js";
import {
  appendLedgerEntry,
  readLedger,
  readLedgerByTestId,
  getTestIds as _getTestIds,
  getTestTree as _getTestTree,
  getLatestEntries as _getLatestEntries,
  getRunnerStats as _getRunnerStats,
  getAllRunnerStats,
  overrideRunScore as _overrideRunScore,
  getRunOverrides as _getRunOverrides,
} from "./ledger.js";

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
    // The underlying openDb() in ledger.ts auto-creates the DB and schema on first call.
    // No explicit init needed — schema is lazily created per operation.
  }

  recordRun(entry: LedgerEntry): void {
    appendLedgerEntry(this.outputDir, entry);
  }

  getRuns(testId?: string): LedgerEntry[] {
    return testId ? readLedgerByTestId(this.outputDir, testId) : readLedger(this.outputDir);
  }

  getRunById(id: number): LedgerEntry | undefined {
    const all = readLedger(this.outputDir);
    return all.find((e) => e.id === id);
  }

  getTestIds(): string[] {
    return _getTestIds(this.outputDir);
  }

  getTestTree(): TestTreeNode[] {
    return _getTestTree(this.outputDir);
  }

  getLatestEntries(): Map<string, LedgerEntry> {
    return _getLatestEntries(this.outputDir);
  }

  getStats(testId?: string): RunnerStats[] {
    return testId ? _getRunnerStats(this.outputDir, testId) : getAllRunnerStats(this.outputDir);
  }

  overrideRunScore(runId: number, score: number, reason: string): ScoreOverride {
    return _overrideRunScore(this.outputDir, runId, score, reason);
  }

  getRunOverrides(runId: number): ScoreOverride[] {
    return _getRunOverrides(this.outputDir, runId);
  }
}
