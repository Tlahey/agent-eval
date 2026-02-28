import type { LedgerRun, CommandResult, RunnerStats } from "../lib/api";
import type { TestTreeNode } from "../lib/api";

export function createMockRun(overrides: Partial<LedgerRun> = {}): LedgerRun {
  return {
    id: 1,
    testId: "add close button to Banner",
    suitePath: ["UI Components", "Banner"],
    timestamp: "2026-02-20T10:00:00.000Z",
    agentRunner: "copilot",
    judgeModel: "gpt-4o",
    score: 0.88,
    pass: true,
    reason: "The close button was added correctly with proper event handling.",
    improvement: "Consider adding an aria-label for accessibility.",
    context: {
      diff: `diff --git a/src/Banner.tsx b/src/Banner.tsx
index 1234567..abcdefg 100644
--- a/src/Banner.tsx
+++ b/src/Banner.tsx
@@ -1,4 +1,8 @@
 import React from "react";
+import { IoClose } from "react-icons/io5";
 
 export const Banner = ({ text }) => {
-  return <div className="banner">{text}</div>;
+  return (
+    <div className="banner">
+      {text}
+      <button onClick={() => {}} aria-label="Close"><IoClose /></button>
+    </div>
+  );
 };`,
      commands: [
        {
          name: "unit tests",
          command: "pnpm test",
          stdout: "Tests: 5 passed",
          stderr: "",
          exitCode: 0,
          durationMs: 4200,
        },
        {
          name: "type check",
          command: "tsc --noEmit",
          stdout: "",
          stderr: "error TS2345: Argument of type...",
          exitCode: 1,
          durationMs: 3100,
        },
      ],
    },
    durationMs: 45000,
    ...overrides,
  };
}

export function createMockRuns(count = 5): LedgerRun[] {
  const runners = ["copilot", "cursor", "claude-code", "aider"];
  const testIds = ["add close button to Banner", "implement search with debounce"];
  return Array.from({ length: count }, (_, i) =>
    createMockRun({
      id: i + 1,
      testId: testIds[i % testIds.length],
      agentRunner: runners[i % runners.length],
      score: 0.5 + Math.random() * 0.5,
      pass: i % 3 !== 0,
      timestamp: new Date(Date.now() - i * 86400000).toISOString(),
      durationMs: 20000 + i * 10000,
    }),
  );
}

export function createMockStats(): RunnerStats[] {
  return [
    { agentRunner: "copilot", totalRuns: 20, avgScore: 0.85, passRate: 0.9 },
    { agentRunner: "cursor", totalRuns: 18, avgScore: 0.74, passRate: 0.72 },
    { agentRunner: "claude-code", totalRuns: 17, avgScore: 0.86, passRate: 0.88 },
    { agentRunner: "aider", totalRuns: 17, avgScore: 0.67, passRate: 0.59 },
  ];
}

export function createMockCommands(): CommandResult[] {
  return [
    {
      name: "unit tests",
      command: "pnpm test",
      stdout: "Tests: 10 passed (10)",
      stderr: "",
      exitCode: 0,
      durationMs: 5000,
    },
    {
      name: "lint",
      command: "pnpm lint",
      stdout: "",
      stderr: "2 errors found",
      exitCode: 1,
      durationMs: 2000,
    },
  ];
}

export function createMockTree(): TestTreeNode[] {
  return [
    {
      name: "UI Components",
      type: "suite",
      children: [
        {
          name: "Banner",
          type: "suite",
          children: [
            {
              name: "add close button to Banner",
              type: "test",
              testId: "add close button to Banner",
            },
          ],
        },
        {
          name: "Search",
          type: "suite",
          children: [
            {
              name: "implement search with debounce",
              type: "test",
              testId: "implement search with debounce",
            },
          ],
        },
      ],
    },
    { name: "refactor API service layer", type: "test", testId: "refactor API service layer" },
  ];
}
