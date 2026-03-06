import * as mocks from "../test/fixtures";

export interface CommandResult {
  name: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface TaskResult {
  task: { name: string; criteria: string; weight?: number };
  result: CommandResult;
}

export interface TimingData {
  totalMs: number;
  setupMs?: number;
  agentMs?: number;
  tasksMs?: number;
  judgeMs?: number;
}

export type TestStatus = "PASS" | "WARN" | "FAIL";

export interface LedgerRun {
  id?: number;
  testId: string;
  suitePath: string[];
  timestamp: string;
  // Execution data
  agentRunner: string;
  instruction: string;
  diff: string | null;
  changedFiles: string[];
  commands: CommandResult[];
  taskResults: TaskResult[];
  agentTokenUsage?: TokenUsage;
  timing: TimingData;
  agentOutput?: string;
  logs: string;
  // Judgment data
  judgeModel: string;
  score: number;
  pass: boolean;
  status: TestStatus;
  reason: string;
  improvement: string;
  judgeTokenUsage?: TokenUsage;
  criteria: string;
  expectedFiles?: string[];
  thresholds: { warn: number; fail: number };
  durationMs: number;
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

/** A tree node representing a suite or test in the hierarchy */
export interface TestTreeNode {
  name: string;
  type: "suite" | "test";
  testId?: string;
  tags?: string[];
  children?: TestTreeNode[];
}

const BASE = "/api";

// Helper to wrap fetch with a mock fallback in development
async function fetchWithFallback<T>(
  url: string,
  mockData: T | (() => T),
  errorMessage: string,
): Promise<T> {
  try {
    const res = await fetch(url);
    if (res.ok) return await res.json();
    throw new Error(`${errorMessage}: ${res.statusText || res.status || "Unknown error"}`);
  } catch (err) {
    // In development AND not in Vitest tests, if server is unreachable, use mock data
    const isDev = import.meta.env.DEV;
    const isTest =
      typeof (window as any).process?.env?.VITEST !== "undefined" ||
      (typeof process !== "undefined" && process.env.NODE_ENV === "test");

    if (isDev && !isTest) {
      console.warn(`API unavailable at ${url}, using mock data.`, err);
      return typeof mockData === "function" ? (mockData as () => T)() : mockData;
    }
    throw err;
  }
}

export async function fetchRuns(testId?: string): Promise<LedgerRun[]> {
  const url = testId ? `${BASE}/runs?testId=${encodeURIComponent(testId)}` : `${BASE}/runs`;
  return fetchWithFallback(url, () => mocks.createMockRuns(20), "Failed to fetch runs");
}

export async function fetchRun(id: number): Promise<LedgerRun> {
  return fetchWithFallback(
    `${BASE}/runs/${id}`,
    () => mocks.createMockRun({ id }),
    "Failed to fetch run",
  );
}

export async function fetchTestIds(): Promise<string[]> {
  return fetchWithFallback(
    `${BASE}/tests`,
    ["add close button to Banner", "implement search with debounce"],
    "Failed to fetch tests",
  );
}

export async function fetchTags(): Promise<string[]> {
  return fetchWithFallback(`${BASE}/tags`, ["ui", "core", "agent", "bug"], "Failed to fetch tags");
}

export async function fetchTestTree(): Promise<TestTreeNode[]> {
  return fetchWithFallback(
    `${BASE}/tree`,
    () => mocks.createMockTree(),
    "Failed to fetch test tree",
  );
}

export async function fetchStats(): Promise<RunnerStats[]> {
  return fetchWithFallback(`${BASE}/stats`, () => mocks.createMockStats(), "Failed to fetch stats");
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

export async function deleteTest(testId: string): Promise<void> {
  const res = await fetch(`${BASE}/tests?testId=${encodeURIComponent(testId)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Failed to delete test: ${res.statusText}`);
}

export async function deleteSuite(path: string[]): Promise<void> {
  const res = await fetch(`${BASE}/suites?path=${encodeURIComponent(path.join(","))}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Failed to delete suite: ${res.statusText}`);
}
