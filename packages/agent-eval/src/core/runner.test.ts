import { describe, it, expect, vi, beforeEach } from "vitest";
import { runTest, dryRunTest, setLastJudgeOptions } from "./runner.js";
import type { AgentEvalConfig, TestDefinition, RunnerConfig } from "./types.js";

// Mock external deps
vi.mock("../git/git.js", () => ({
  gitResetHard: vi.fn(),
  gitDiff: vi.fn(() => "mock diff content"),
}));

vi.mock("../ledger/ledger.js", () => ({
  appendLedgerEntry: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

// Mock LocalEnvironment
const mockEnvInstance = {
  name: "local",
  setup: vi.fn(),
  execute: vi.fn(() => ({ stdout: "", stderr: "", exitCode: 0 })),
  getDiff: vi.fn(() => "mock diff content"),
};
vi.mock("../environment/plugins/local.js", () => ({
  LocalEnvironment: vi.fn(() => mockEnvInstance),
}));

vi.mock("../judge/judge.js", () => ({
  judge: vi.fn(() => ({
    result: { pass: true, score: 0.85, reason: "good", improvement: "none" },
  })),
  buildJudgePrompt: vi.fn(() => "mock judge prompt"),
  extractChangedFiles: vi.fn(() => []),
  filterDiff: vi.fn((diff) => diff),
}));

function createMockRunner(id: string): RunnerConfig {
  return {
    id,
    model: {
      type: "cli" as const,
      name: "mock-cli",
      command: `echo "{{prompt}}"`,
    },
  };
}

describe("runner - runTest", () => {
  const baseConfig: AgentEvalConfig = {
    rootDir: "/tmp/test",
    runners: [createMockRunner("mock-cli")],
    judge: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnvInstance.execute.mockReturnValue({ stdout: "", stderr: "", exitCode: 0 });
    mockEnvInstance.getDiff.mockReturnValue("mock diff content");
  });

  it("executes the mission defined in the test logic", async () => {
    const testDef: TestDefinition = {
      title: "test-mission",
      mission: "", // Empty in def, set in fn
      fn: ({ ctx }) => {
        ctx.prompt("hello mission");
        setLastJudgeOptions({ criteria: "ok" });
      },
    };

    const results = await runTest(testDef, baseConfig);
    expect(results).toHaveLength(1);
    expect(mockEnvInstance.execute).toHaveBeenCalledWith(
      expect.stringContaining("hello mission"),
      expect.anything(),
      expect.anything(),
    );
  });

  it("handles test variants correctly", async () => {
    const testDef: TestDefinition = {
      title: "test-variants",
      mission: "",
      variants: [
        { id: "v1", name: "V1", runnerId: "mock-cli" },
        { id: "v2", name: "V2", runnerId: "mock-cli", enrichPrompt: "Prefix: {{prompt}}" },
      ],
      fn: ({ ctx }) => {
        ctx.prompt("mission");
        setLastJudgeOptions({ criteria: "ok" });
      },
    };

    const results = await runTest(testDef, baseConfig);
    expect(results).toHaveLength(2);
    expect(mockEnvInstance.execute).toHaveBeenCalledWith(
      'echo "mission"',
      expect.anything(),
      expect.anything(),
    );
    expect(mockEnvInstance.execute).toHaveBeenCalledWith(
      'echo "Prefix: mission"',
      expect.anything(),
      expect.anything(),
    );
  });

  it("respects defaultRunner in config", async () => {
    const config = {
      ...baseConfig,
      runners: [createMockRunner("r1"), createMockRunner("r2")],
      defaultRunner: "r2",
    };
    const testDef: TestDefinition = {
      title: "test-default",
      mission: "",
      fn: ({ ctx }) => {
        ctx.prompt("ok");
        setLastJudgeOptions({ criteria: "ok" });
      },
    };

    const results = await runTest(testDef, config);
    expect(results).toHaveLength(1);
    expect(results[0].runner).toBe("r2");
  });
});

describe("runner - dryRunTest", () => {
  it("returns simplified plan", async () => {
    const testDef: TestDefinition = {
      title: "dry",
      mission: "go",
      fn: () => {},
    };
    const plan = await dryRunTest(testDef, {} as any);
    expect(plan.testId).toBe("dry");
  });
});
