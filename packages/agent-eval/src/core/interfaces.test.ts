import { describe, it, expect } from "vitest";
import type {
  ILedgerPlugin,
  IJudgePlugin,
  IModelPlugin,
  ModelSettings,
  ICliModel,
  CliOutputMetrics,
  RunnerStats,
  TestTreeNode,
} from "./interfaces.js";
import { isCliModel } from "./interfaces.js";

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

  describe("IModelPlugin contract", () => {
    it("defines the required shape for a model plugin", () => {
      const mockModel: IModelPlugin = {
        name: "openai",
        modelId: "gpt-4o",
        createModel: () => ({ type: "mock-model" }),
      };
      expect(mockModel.name).toBe("openai");
      expect(mockModel.modelId).toBe("gpt-4o");
      expect(typeof mockModel.createModel).toBe("function");
    });

    it("allows async createModel", async () => {
      const asyncModel: IModelPlugin = {
        name: "anthropic",
        modelId: "claude-sonnet-4-20250514",
        createModel: async () => ({ type: "async-model" }),
      };
      const result = await asyncModel.createModel();
      expect(result).toEqual({ type: "async-model" });
    });

    it("accepts optional settings (ModelSettings)", () => {
      const model: IModelPlugin = {
        name: "openai",
        modelId: "gpt-4o",
        settings: { temperature: 0.7, maxTokens: 2048, topP: 0.9 },
        createModel: () => ({}),
      };
      expect(model.settings?.temperature).toBe(0.7);
      expect(model.settings?.maxTokens).toBe(2048);
      expect(model.settings?.topP).toBe(0.9);
    });

    it("accepts optional tools", () => {
      const mockTool = { description: "Read a file", parameters: {}, execute: () => "content" };
      const model: IModelPlugin = {
        name: "openai",
        modelId: "gpt-4o",
        tools: { readFile: mockTool },
        createModel: () => ({}),
      };
      expect(model.tools).toBeDefined();
      expect(model.tools!.readFile).toBe(mockTool);
    });

    it("accepts maxSteps in ModelSettings for agentic tool calling", () => {
      const model: IModelPlugin = {
        name: "github-models",
        modelId: "openai/gpt-5-mini",
        settings: { temperature: 1, maxSteps: 15 },
        tools: { someAction: {} },
        createModel: () => ({}),
      };
      expect(model.settings?.maxSteps).toBe(15);
      expect(model.tools).toBeDefined();
    });
  });

  describe("ModelSettings type", () => {
    it("allows all fields to be optional", () => {
      const settings: ModelSettings = {};
      expect(settings.temperature).toBeUndefined();
      expect(settings.maxTokens).toBeUndefined();
      expect(settings.topP).toBeUndefined();
      expect(settings.maxSteps).toBeUndefined();
    });

    it("accepts all generation settings", () => {
      const settings: ModelSettings = {
        temperature: 0.5,
        maxTokens: 4096,
        topP: 0.95,
        maxSteps: 10,
      };
      expect(settings.temperature).toBe(0.5);
      expect(settings.maxTokens).toBe(4096);
      expect(settings.topP).toBe(0.95);
      expect(settings.maxSteps).toBe(10);
    });
  });

  describe("ICliModel contract", () => {
    it("defines the required shape for a CLI model", () => {
      const cliModel: ICliModel = {
        type: "cli",
        name: "aider",
        command: 'aider --message "{{prompt}}" --yes',
      };
      expect(cliModel.type).toBe("cli");
      expect(cliModel.name).toBe("aider");
      expect(cliModel.command).toContain("{{prompt}}");
    });

    it("allows optional parseOutput for token extraction", () => {
      const cliModel: ICliModel = {
        type: "cli",
        name: "claude-code",
        command: 'claude -p "{{prompt}}" --output-format json',
        parseOutput: ({ stdout }) => {
          const json = JSON.parse(stdout);
          return {
            tokenUsage: {
              inputTokens: json.usage.input_tokens,
              outputTokens: json.usage.output_tokens,
              totalTokens: json.usage.input_tokens + json.usage.output_tokens,
            },
            agentOutput: json.result,
          };
        },
      };
      expect(cliModel.parseOutput).toBeDefined();

      const metrics = cliModel.parseOutput!({
        stdout: JSON.stringify({
          result: "Done",
          usage: { input_tokens: 1000, output_tokens: 500 },
        }),
        stderr: "",
      });
      expect(metrics.tokenUsage).toEqual({
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
      });
      expect(metrics.agentOutput).toBe("Done");
    });

    it("works without parseOutput (e.g., Copilot CLI)", () => {
      const cliModel: ICliModel = {
        type: "cli",
        name: "copilot",
        command: 'gh copilot suggest "{{prompt}}"',
      };
      expect(cliModel.parseOutput).toBeUndefined();
    });
  });

  describe("CliOutputMetrics type", () => {
    it("allows empty metrics (no token data)", () => {
      const metrics: CliOutputMetrics = {};
      expect(metrics.tokenUsage).toBeUndefined();
      expect(metrics.agentOutput).toBeUndefined();
    });

    it("allows partial metrics (tokens only)", () => {
      const metrics: CliOutputMetrics = {
        tokenUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      };
      expect(metrics.tokenUsage?.totalTokens).toBe(150);
      expect(metrics.agentOutput).toBeUndefined();
    });
  });

  describe("isCliModel type guard", () => {
    it("returns true for CLI models", () => {
      const cliModel: ICliModel = { type: "cli", name: "test", command: "echo {{prompt}}" };
      expect(isCliModel(cliModel)).toBe(true);
    });

    it("returns false for IModelPlugin", () => {
      const apiModel: IModelPlugin = {
        name: "openai",
        modelId: "gpt-4o",
        createModel: () => ({}) as never,
      };
      expect(isCliModel(apiModel)).toBe(false);
    });

    it("returns false for objects without type property", () => {
      expect(isCliModel({ name: "test" } as never)).toBe(false);
    });
  });
});
