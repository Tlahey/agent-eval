import type { LedgerRun, RunnerStats, TestStatus } from "../lib/api";
import type { TestTreeNode } from "../lib/api";

function computeStatus(score: number, thresholds = { warn: 0.8, fail: 0.5 }): TestStatus {
  if (score >= thresholds.warn) return "PASS";
  if (score >= thresholds.fail) return "WARN";
  return "FAIL";
}

export function createMockRun(overrides: Partial<LedgerRun> = {}): LedgerRun {
  const score = overrides.score ?? 0.88;
  const thresholds = overrides.thresholds ?? { warn: 0.8, fail: 0.5 };
  const status = overrides.status ?? computeStatus(score, thresholds);
  return {
    id: 1,
    testId: "complex-refactoring-task",
    suitePath: ["AB Tests"],
    timestamp: new Date().toISOString(),
    variantName: "baseline",
    basePrompt: "Refactor this legacy code",
    agentRunner: "gpt-4o",
    instruction: "Refactor this legacy code",
    diff: "diff content",
    changedFiles: ["src/main.ts"],
    commands: [],
    taskResults: [],
    agentTokenUsage: { inputTokens: 2000, outputTokens: 1000, totalTokens: 3000 },
    judgeTokenUsage: { inputTokens: 1500, outputTokens: 300, totalTokens: 1800 },
    timing: { totalMs: 30000, agentMs: 25000, judgeMs: 5000 },
    logs: "",
    judgeModel: "gpt-4o",
    score,
    pass: status !== "FAIL",
    status,
    reason: "Reasoning",
    improvement: "Improvement",
    criteria: "Criteria",
    expectedFiles: ["src/main.ts"],
    durationMs: 30000,
    thresholds,
    ...overrides,
  };
}

export function createMockRuns(count = 5): LedgerRun[] {
  const variants = ["baseline", "with skills", "with MCP", "skill-v2-optimized"];
  const runners = ["gpt-4o", "claude-3-5-sonnet"];

  return Array.from({ length: count }, (_, i) => {
    const variantName = variants[i % variants.length];
    const scoreBoost = variantName === "baseline" ? 0 : 0.1 + (i % 3) * 0.05;
    const score = Math.min(1, 0.6 + scoreBoost);

    return createMockRun({
      id: i + 1,
      variantName,
      agentRunner: runners[i % runners.length],
      score,
      timestamp: new Date(Date.now() - i * 3600000).toISOString(),
    });
  });
}

export function createMockStats(): RunnerStats[] {
  return [
    { agentRunner: "gpt-4o", totalRuns: 50, avgScore: 0.82, passRate: 0.85 },
    { agentRunner: "claude-3-5-sonnet", totalRuns: 45, avgScore: 0.88, passRate: 0.92 },
  ];
}

export function createMockTree(): TestTreeNode[] {
  return [
    {
      name: "AB Tests",
      type: "suite",
      children: [
        { name: "complex-refactoring-task", type: "test", testId: "complex-refactoring-task" },
        { name: "bug-fix-edge-case", type: "test", testId: "bug-fix-edge-case" },
      ],
    },
  ];
}
