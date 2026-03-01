import { describe, it, expect } from "vitest";
import type { ILedgerPlugin, IJudgePlugin, RunnerStats, TestTreeNode } from "./interfaces.js";

describe("Plugin Interfaces", () => {
  describe("ILedgerPlugin contract", () => {
    it("defines the required shape for a ledger plugin", () => {
      const mockLedger: ILedgerPlugin = {
        name: "mock-ledger",
        initialize: () => {},
        recordRun: () => {},
        getRuns: () => [],
        getRunById: () => undefined,
        getTestIds: () => [],
        getTestTree: () => [],
        getLatestEntries: () => new Map(),
        getStats: () => [],
        overrideRunScore: () => ({
          score: 0.8,
          pass: true,
          status: "PASS" as const,
          reason: "test",
          timestamp: new Date().toISOString(),
        }),
        getRunOverrides: () => [],
      };
      expect(mockLedger.name).toBe("mock-ledger");
      expect(typeof mockLedger.initialize).toBe("function");
      expect(typeof mockLedger.recordRun).toBe("function");
      expect(typeof mockLedger.getRuns).toBe("function");
      expect(typeof mockLedger.getRunById).toBe("function");
      expect(typeof mockLedger.getTestIds).toBe("function");
      expect(typeof mockLedger.getTestTree).toBe("function");
      expect(typeof mockLedger.getLatestEntries).toBe("function");
      expect(typeof mockLedger.getStats).toBe("function");
      expect(typeof mockLedger.overrideRunScore).toBe("function");
      expect(typeof mockLedger.getRunOverrides).toBe("function");
    });

    it("allows optional close method", () => {
      const withClose: ILedgerPlugin = {
        name: "with-close",
        initialize: () => {},
        recordRun: () => {},
        getRuns: () => [],
        getRunById: () => undefined,
        getTestIds: () => [],
        getTestTree: () => [],
        getLatestEntries: () => new Map(),
        getStats: () => [],
        overrideRunScore: () => ({
          score: 0.8,
          pass: true,
          status: "PASS" as const,
          reason: "test",
          timestamp: new Date().toISOString(),
        }),
        getRunOverrides: () => [],
        close: () => {},
      };
      expect(typeof withClose.close).toBe("function");
    });
  });

  describe("IJudgePlugin contract", () => {
    it("defines the required shape for a judge plugin", () => {
      const mockJudge: IJudgePlugin = {
        name: "mock-judge",
        judge: async () => ({
          pass: true,
          score: 0.85,
          reason: "Looks good",
          improvement: "Minor cleanup",
        }),
      };
      expect(mockJudge.name).toBe("mock-judge");
      expect(typeof mockJudge.judge).toBe("function");
    });
  });

  describe("RunnerStats type", () => {
    it("has the expected shape", () => {
      const stats: RunnerStats = {
        agentRunner: "copilot",
        avgScore: 0.85,
        totalRuns: 10,
        passRate: 0.9,
      };
      expect(stats.agentRunner).toBe("copilot");
      expect(stats.avgScore).toBe(0.85);
      expect(stats.totalRuns).toBe(10);
      expect(stats.passRate).toBe(0.9);
    });
  });

  describe("TestTreeNode type", () => {
    it("supports nested suite/test hierarchy", () => {
      const tree: TestTreeNode[] = [
        {
          name: "UI Components",
          type: "suite",
          children: [
            {
              name: "Add close button",
              type: "test",
              testId: "Add close button",
            },
          ],
        },
      ];
      expect(tree[0].type).toBe("suite");
      expect(tree[0].children?.[0].type).toBe("test");
      expect(tree[0].children?.[0].testId).toBe("Add close button");
    });
  });
});
