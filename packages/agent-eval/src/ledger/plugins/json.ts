/**
 * JSON Ledger Plugin — stores evaluation runs as newline-delimited JSON (JSONL).
 *
 * This is the lightweight fallback ledger that works everywhere without
 * requiring Node 22's experimental node:sqlite module.
 */

import { mkdirSync, readFileSync, appendFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { LedgerEntry, ScoreOverride, Thresholds } from "../../core/types.js";
import { computeStatus, DEFAULT_THRESHOLDS } from "../../core/types.js";
import type { ILedgerPlugin, RunnerStats, TestTreeNode } from "../../core/interfaces.js";

export interface JsonLedgerOptions {
  /** Directory where ledger.jsonl is stored (defaults to ".agenteval") */
  outputDir?: string;
}

/** Internal entry shape stored in JSONL (includes auto-assigned id) */
interface StoredEntry extends LedgerEntry {
  id: number;
}

export class JsonLedger implements ILedgerPlugin {
  readonly name = "json";
  private outputDir: string;
  private runsFile: string;
  private nextId = 1;

  constructor(options?: JsonLedgerOptions) {
    this.outputDir = options?.outputDir ?? ".agenteval";
    this.runsFile = join(this.outputDir, "ledger.jsonl");
  }

  initialize(): void {
    mkdirSync(this.outputDir, { recursive: true });
    // Compute next ID from existing entries
    if (existsSync(this.runsFile)) {
      const entries = this.readAllRuns();
      if (entries.length > 0) {
        this.nextId = Math.max(...entries.map((e) => e.id)) + 1;
      }
    }
  }

  recordRun(entry: LedgerEntry): void {
    const stored: StoredEntry = { ...entry, id: this.nextId++ };
    appendFileSync(this.runsFile, JSON.stringify(stored) + "\n", "utf-8");
  }

  getRuns(testId?: string): LedgerEntry[] {
    const entries = this.readAllRuns();
    return testId ? entries.filter((e) => e.testId === testId) : entries;
  }

  getRunById(id: number): LedgerEntry | undefined {
    return this.readAllRuns().find((r) => r.id === id);
  }

  getTestIds(): string[] {
    return [...new Set(this.readAllRuns().map((r) => r.testId))].sort();
  }

  getTestTree(): TestTreeNode[] {
    const runs = this.readAllRuns();
    const seen = new Map<string, string[]>();

    for (const run of runs) {
      if (!seen.has(run.testId)) {
        seen.set(run.testId, run.suitePath ?? []);
      }
    }

    const root: TestTreeNode[] = [];
    for (const [testId, suitePath] of seen) {
      if (suitePath.length === 0) {
        root.push({ name: testId, type: "test", testId });
        continue;
      }
      let current = root;
      for (const suiteName of suitePath) {
        let suiteNode = current.find((n) => n.type === "suite" && n.name === suiteName);
        if (!suiteNode) {
          suiteNode = { name: suiteName, type: "suite", children: [] };
          current.push(suiteNode);
        }
        if (!suiteNode.children) suiteNode.children = [];
        current = suiteNode.children;
      }
      current.push({ name: testId, type: "test", testId });
    }
    return root;
  }

  getLatestEntries(): Map<string, LedgerEntry> {
    const runs = this.readAllRuns();
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
    const runs = this.getRuns(testId);
    const byRunner = new Map<string, { scores: number[]; passes: number }>();

    for (const run of runs) {
      const key = run.agentRunner;
      if (!byRunner.has(key)) byRunner.set(key, { scores: [], passes: 0 });
      const bucket = byRunner.get(key)!;

      const effectiveScore = run.override ? run.override.score : run.score;
      const effectivePass = run.override ? run.override.pass : run.pass;
      bucket.scores.push(effectiveScore);
      if (effectivePass) bucket.passes++;
    }

    return [...byRunner.entries()]
      .map(([agentRunner, { scores, passes }]) => ({
        agentRunner,
        avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
        totalRuns: scores.length,
        passRate: passes / scores.length,
      }))
      .sort((a, b) => b.avgScore - a.avgScore);
  }

  overrideRunScore(runId: number, score: number, reason: string): ScoreOverride {
    if (score < 0 || score > 1) throw new Error("Score must be between 0 and 1");
    if (!reason.trim()) throw new Error("Reason is required");

    const runs = this.readAllRuns();
    const index = runs.findIndex((r) => r.id === runId);
    if (index === -1) throw new Error(`Run #${runId} not found`);

    const run = runs[index];
    const thresholds: Thresholds = run.thresholds ?? DEFAULT_THRESHOLDS;
    const status = computeStatus(score, thresholds);
    const timestamp = new Date().toISOString();

    const override: ScoreOverride = {
      score,
      pass: status !== "FAIL",
      status,
      reason: reason.trim(),
      timestamp,
    };

    // Update the run in place
    runs[index].override = override;

    // Rewrite the entire JSONL file to persist the update
    const content = runs.map((r) => JSON.stringify(r)).join("\n") + "\n";
    writeFileSync(this.runsFile, content, "utf-8");

    return override;
  }

  getRunOverrides(runId: number): ScoreOverride[] {
    const run = this.getRunById(runId);
    return run?.override ? [run.override] : [];
  }

  // ─── Private helpers ───

  private readAllRuns(): StoredEntry[] {
    if (!existsSync(this.runsFile)) return [];
    const content = readFileSync(this.runsFile, "utf-8").trim();
    if (!content) return [];
    return content.split("\n").map((line) => JSON.parse(line) as StoredEntry);
  }
}
