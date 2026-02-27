export interface LedgerRun {
  id: number;
  testId: string;
  timestamp: string;
  agentRunner: string;
  judgeModel: string;
  score: number;
  pass: boolean;
  reason: string;
  diff: string | null;
  commands: string;
  durationMs: number;
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

export async function fetchStats(): Promise<RunnerStats[]> {
  const res = await fetch(`${BASE}/stats`);
  if (!res.ok) throw new Error(`Failed to fetch stats: ${res.statusText}`);
  return res.json();
}
