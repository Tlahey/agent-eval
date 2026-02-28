export interface CommandResult {
  name: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

export type TestStatus = "PASS" | "WARN" | "FAIL";

export interface LedgerRun {
  id?: number;
  testId: string;
  suitePath: string[];
  timestamp: string;
  agentRunner: string;
  judgeModel: string;
  score: number;
  pass: boolean;
  status: TestStatus;
  reason: string;
  improvement: string;
  context: {
    diff: string | null;
    commands: CommandResult[];
  };
  durationMs: number;
  thresholds: { warn: number; fail: number };
  override?: ScoreOverride;
}

export interface ScoreOverride {
  score: number;
  pass: boolean;
  status: TestStatus;
  reason: string;
  timestamp: string;
}

export interface RunnerStats {
  agentRunner: string;
  totalRuns: number;
  avgScore: number;
  passRate: number;
}

const BASE = "/api";

export async function fetchRuns(testId?: string): Promise<LedgerRun[]> {
  const url = testId ? `${BASE}/runs?testId=${encodeURIComponent(testId)}` : `${BASE}/runs`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch runs: ${res.statusText}`);
  return res.json();
}

export async function fetchRun(id: number): Promise<LedgerRun> {
  const res = await fetch(`${BASE}/runs/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch run: ${res.statusText}`);
  return res.json();
}

export async function fetchTestIds(): Promise<string[]> {
  const res = await fetch(`${BASE}/tests`);
  if (!res.ok) throw new Error(`Failed to fetch tests: ${res.statusText}`);
  return res.json();
}

/** A tree node representing a suite or test in the hierarchy */
export interface TestTreeNode {
  name: string;
  type: "suite" | "test";
  testId?: string;
  children?: TestTreeNode[];
}

export async function fetchTestTree(): Promise<TestTreeNode[]> {
  const res = await fetch(`${BASE}/tree`);
  if (!res.ok) throw new Error(`Failed to fetch test tree: ${res.statusText}`);
  return res.json();
}

export async function fetchStats(): Promise<RunnerStats[]> {
  const res = await fetch(`${BASE}/stats`);
  if (!res.ok) throw new Error(`Failed to fetch stats: ${res.statusText}`);
  return res.json();
}

export async function overrideScore(
  runId: number,
  score: number,
  reason: string,
): Promise<ScoreOverride> {
  const res = await fetch(`${BASE}/runs/${runId}/override`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ score, reason }),
  });
  if (!res.ok) {
    const body = (await res.json()) as { error?: string };
    throw new Error(body.error ?? `Failed to override score: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchOverrides(runId: number): Promise<ScoreOverride[]> {
  const res = await fetch(`${BASE}/runs/${runId}/overrides`);
  if (!res.ok) throw new Error(`Failed to fetch overrides: ${res.statusText}`);
  return res.json();
}
