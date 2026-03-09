import { describe, it, expect, vi, beforeEach } from "vitest";
import { runTest, dryRunTest, setLastJudgeOptions } from "./runner.js";
import type { AgentEvalConfig, TestDefinition, RunnerConfig } from "./types.js";

// Mock environment
const mockEnvInstance = {
  name: "local",
  setup: vi.fn(),
  execute: vi.fn(() => ({ stdout: "ok", stderr: "", exitCode: 0 })),
  getDiff: vi.fn(() => "mock diff"),
};

vi.mock("../environment/plugins/local.js", () => ({
  LocalEnvironment: vi.fn(() => mockEnvInstance),
}));

vi.mock("../judge/judge.js", () => ({
  judge: vi.fn(() => ({
    result: { pass: true, score: 0.9, reason: "good", improvement: "none" },
  })),
  buildJudgePrompt: vi.fn(() => "mock prompt"),
  extractChangedFiles: vi.fn(() => []),
  filterDiff: vi.fn((d) => d),
}));

describe("runner - runTest", () => {
  const runner: RunnerConfig = {
    id: "r1",
    model: { type: "cli", name: "cli", command: 'echo "{{prompt}}"' } as any,
  };
  const config: AgentEvalConfig = {
    runners: [runner],
    judge: { model: {} as any },
    outputDir: "/tmp/agenteval-test-runner", // Use isolated dir
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("executes all variants of a test", async () => {
    const testDef: TestDefinition = {
      title: "test",
      variants: [
        { name: "V1", runner: "r1" },
        { name: "V2", runner: "r1", enrichPrompt: "Prefix: {{prompt}}" },
      ],
      fn: ({ ctx }) => {
        ctx.prompt("mission");
        setLastJudgeOptions({ criteria: "ok" });
      },
    };

    const results = await runTest(testDef, config);
    expect(results).toHaveLength(2);
    expect(mockEnvInstance.execute).toHaveBeenCalledTimes(2);
  });

  it("throws if a variant uses an unknown runner", async () => {
    const testDef: TestDefinition = {
      title: "fail",
      variants: [{ name: "Bad", runner: "unknown" }],
      fn: () => {},
    };
    await expect(runTest(testDef, config)).rejects.toThrow('Runner "unknown" not found');
  });
});

describe("runner - dryRunTest", () => {
  it("returns simplified plan with variants", async () => {
    const testDef: TestDefinition = {
      title: "dry",
      variants: [{ name: "V", runner: "r" }],
      fn: () => {},
    };
    const plan = await dryRunTest(testDef, {} as any);
    expect(plan.testId).toBe("dry");
    expect(plan.variants).toHaveLength(1);
  });
});
