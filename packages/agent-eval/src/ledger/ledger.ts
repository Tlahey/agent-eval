import { mkdirSync, appendFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import type { LedgerEntry } from "../core/types.js";

/**
 * Resolve the ledger file path.
 */
function ledgerPath(outputDir: string): string {
  return join(outputDir, "ledger.jsonl");
}

/**
 * Append a single entry to the JSONL ledger file.
 */
export function appendLedgerEntry(
  outputDir: string,
  entry: LedgerEntry
): void {
  const filePath = ledgerPath(outputDir);
  mkdirSync(dirname(filePath), { recursive: true });
  appendFileSync(filePath, JSON.stringify(entry) + "\n", "utf-8");
}

/**
 * Read all ledger entries from the JSONL file.
 */
export function readLedger(outputDir: string): LedgerEntry[] {
  const filePath = ledgerPath(outputDir);

  if (!existsSync(filePath)) {
    return [];
  }

  const content = readFileSync(filePath, "utf-8");
  return content
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as LedgerEntry);
}

/**
 * Read ledger entries for a specific test ID.
 */
export function readLedgerByTestId(
  outputDir: string,
  testId: string
): LedgerEntry[] {
  return readLedger(outputDir).filter((e) => e.testId === testId);
}

/**
 * Get unique test IDs from the ledger.
 */
export function getTestIds(outputDir: string): string[] {
  const entries = readLedger(outputDir);
  return [...new Set(entries.map((e) => e.testId))];
}

/**
 * Get the latest entry for each test ID.
 */
export function getLatestEntries(
  outputDir: string
): Map<string, LedgerEntry> {
  const entries = readLedger(outputDir);
  const latest = new Map<string, LedgerEntry>();

  for (const entry of entries) {
    const existing = latest.get(entry.testId);
    if (!existing || entry.timestamp > existing.timestamp) {
      latest.set(entry.testId, entry);
    }
  }

  return latest;
}
