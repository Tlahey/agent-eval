import { describe, it, expect, vi, beforeEach } from "vitest";
import { expect as evalExpect, setJudgeConfig, clearJudgeConfig } from "./expect.js";
import { judge as runJudge } from "../judge/judge.js";
import type { TestContext, JudgeResult } from "./types.js";

// Mock the judge module
vi.mock("../judge/judge.js", () => ({
  judge: vi.fn(),
  buildJudgePrompt: vi.fn(() => "mock prompt"),
  extractChangedFiles: vi.fn(() => []),
  filterDiff: vi.fn((diff) => diff),
}));

// Mock runner to avoid side effects
vi.mock("./runner.js", () => ({
  setLastJudgeOptions: vi.fn(),
  setLastJudgeResult: vi.fn(),
  getJudgeReporterContext: vi.fn(() => null),
}));

describe("expect", () => {
  const mockCtx: TestContext = {
    cwd: "/tmp",
    prompt: vi.fn(),
    storeDiff: vi.fn(),
    addTask: vi.fn(),
    runCommand: vi.fn(),
    setRunnerInfo: vi.fn(),
    setInstruction: vi.fn(),
    diff: "mock diff",
    commands: [],
    tasks: [],
    logs: "mock logs",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    clearJudgeConfig();
  });

  it("throws if judge config is not set", async () => {
    await expect(evalExpect(mockCtx).toPassJudge({ criteria: "test" })).rejects.toThrow(
      "Judge config not set",
    );
  });

  it("calls judge and returns result on pass", async () => {
    const mockResult: JudgeResult = {
      pass: true,
      score: 0.9,
      reason: "good",
      improvement: "none",
    };
    vi.mocked(runJudge).mockResolvedValue({ result: mockResult });

    setJudgeConfig({ model: { name: "test", modelId: "m", createModel: () => ({}) } as any });

    const result = await evalExpect(mockCtx).toPassJudge({ criteria: "should pass" });

    expect(result.pass).toBe(true);
    expect(result.score).toBe(0.9);
    expect(runJudge).toHaveBeenCalled();
  });

  it("throws JudgeFailure when judge returns pass=false", async () => {
    const mockResult: JudgeResult = {
      pass: false,
      score: 0.2,
      reason: "bad",
      improvement: "fix it",
    };
    vi.mocked(runJudge).mockResolvedValue({ result: mockResult });

    setJudgeConfig({ model: { name: "test", modelId: "m", createModel: () => ({}) } as any });

    await expect(evalExpect(mockCtx).toPassJudge({ criteria: "fail" })).rejects.toThrow(
      "Score below threshold",
    );
  });
});
