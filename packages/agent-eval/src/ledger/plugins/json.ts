import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import type { ILedgerPlugin, RunnerStats, TestTreeNode } from "../../core/interfaces.js";
import type { LedgerEntry, ScoreOverride } from "../../core/types.js";
import { computeStatus, DEFAULT_THRESHOLDS } from "../../core/types.js";

interface JsonLedgerOptions {
  outputDir?: string;
}

export class JsonLedger implements ILedgerPlugin {
  readonly name = "json-ledger";
  private outputDir: string;
  private filePath: string;

  constructor(options: JsonLedgerOptions = {}) {
    this.outputDir = options.outputDir ?? ".agenteval";
    this.filePath = resolve(process.cwd(), this.outputDir, "ledger.jsonl");
  }

  async initialize(): Promise<void> {
    const dir = resolve(process.cwd(), this.outputDir);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  async recordRun(entry: LedgerEntry): Promise<void> {
    const line = JSON.stringify(entry) + "\n";
    writeFileSync(this.filePath, line, { flag: "a" });
  }

  async getRuns(testId?: string): Promise<LedgerEntry[]> {
    if (!existsSync(this.filePath)) return [];
    const content = readFileSync(this.filePath, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim() !== "");
    const entries = lines.map((l) => JSON.parse(l) as LedgerEntry);
    if (testId) {
      return entries.filter((e) => e.testId === testId);
    }
    return entries;
  }

  async getRunById(id: number): Promise<LedgerEntry | undefined> {
    const runs = await this.getRuns();
    // For JSONL, we use the 1-based line index as ID
    return runs[id - 1];
  }

  async getTestIds(): Promise<string[]> {
    const runs = await this.getRuns();
    const ids = new Set(runs.map((r) => r.testId));
    return Array.from(ids).sort();
  }

  async getTags(): Promise<string[]> {
    const runs = await this.getRuns();
    const tags = new Set<string>();
    for (const run of runs) {
      if (run.tags) run.tags.forEach((t) => tags.add(t));
    }
    return Array.from(tags).sort();
  }

  async getTestTree(): Promise<TestTreeNode[]> {
    const entries = await this.getRuns();
    const seen = new Map<string, string[]>();

    for (const entry of entries) {
      if (!seen.has(entry.testId)) {
        seen.set(entry.testId, entry.suitePath);
      }
    }

    const root: TestTreeNode[] = [];
    for (const [testId, suitePath] of seen) {
      if (!suitePath || suitePath.length === 0) {
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

  async getLatestEntries(): Promise<Map<string, LedgerEntry>> {
    const runs = await this.getRuns();
    const latest = new Map<string, LedgerEntry>();
    for (const run of runs) {
      latest.set(run.testId, run); // overwrites with later entries
    }
    return latest;
  }

  async getStats(testId?: string): Promise<RunnerStats[]> {
    const entries = await this.getRuns(testId);
    const byRunner = new Map<string, { scores: number[]; passes: number }>();

    for (const entry of entries) {
      const key = entry.agentRunner;
      if (!byRunner.has(key)) byRunner.set(key, { scores: [], passes: 0 });
      const bucket = byRunner.get(key)!;

      const effectiveScore = entry.override ? entry.override.score : entry.score;
      const effectivePass = entry.override
        ? computeStatus(entry.override.score, entry.thresholds) !== "FAIL"
        : entry.pass;

      bucket.scores.push(effectiveScore);
      if (effectivePass) bucket.passes++;
    }

    return Array.from(byRunner.entries()).map(([agentRunner, data]) => ({
      agentRunner,
      avgScore: data.scores.reduce((a, b) => a + b, 0) / data.scores.length,
      totalRuns: data.scores.length,
      passRate: data.passes / data.scores.length,
    }));
  }

  async overrideRunScore(runId: number, score: number, reason: string): Promise<ScoreOverride> {
    const runs = await this.getRuns();
    const index = runId - 1;
    if (!runs[index]) throw new Error(`Run ID ${runId} not found`);

    const timestamp = new Date().toISOString();
    const status = computeStatus(score, runs[index].thresholds ?? DEFAULT_THRESHOLDS);
    const override: ScoreOverride = {
      score,
      reason,
      timestamp,
      pass: status !== "FAIL",
      status,
    };

    runs[index].override = override;

    // Rewrite entire file
    const content = runs.map((r) => JSON.stringify(r)).join("\n") + "\n";
    writeFileSync(this.filePath, content);

    return override;
  }

  async getRunOverrides(runId: number): Promise<ScoreOverride[]> {
    const run = await this.getRunById(runId);
    return run?.override ? [run.override] : [];
  }
}
