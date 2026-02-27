import { describe, it, expect as vitestExpect, vi, beforeEach } from "vitest";
import { expect as agentExpect, setJudgeConfig, clearJudgeConfig } from "./expect.js";
import { clearLastJudgeResult, getLastJudgeResult } from "./runner.js";
import type { TestContext, JudgeConfig } from "./types.js";

// Mock the judge module
vi.mock("../judge/judge.js", () => ({
  judge: vi.fn(),
}));

import { judge as mockJudge } from "../judge/judge.js";

function createMockContext(overrides: Partial<TestContext> = {}): TestContext {
  return {
    storeDiff: vi.fn(),
    runCommand: vi.fn(),
    diff: "diff --git a/test.ts",
    commands: [],
    logs: "mock logs",
    ...overrides,
  };
}

const judgeConfig: JudgeConfig = {
  provider: "openai",
  model: "gpt-4o",
};

describe("expect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearLastJudgeResult();
    clearJudgeConfig();
  });

  it("throws if judge config is not set", async () => {
    const ctx = createMockContext();

    await vitestExpect(agentExpect(ctx).toPassJudge({ criteria: "test" })).rejects.toThrow(
      "Judge config not set",
    );
  });

  it("calls judge and returns result on pass", async () => {
    setJudgeConfig(judgeConfig);
    const ctx = createMockContext();

    vi.mocked(mockJudge).mockResolvedValue({
      pass: true,
      score: 0.9,
      reason: "looks good",
    });

    const result = await agentExpect(ctx).toPassJudge({
      criteria: "test criteria",
    });

    vitestExpect(result.pass).toBe(true);
    vitestExpect(result.score).toBe(0.9);
  });

  it("calls judge with correct arguments", async () => {
    setJudgeConfig(judgeConfig);
    const ctx = createMockContext();

    vi.mocked(mockJudge).mockResolvedValue({
      pass: true,
      score: 0.85,
      reason: "well done",
    });

    await agentExpect(ctx).toPassJudge({
      criteria: "must have close button",
      model: "gpt-4o-mini",
    });

    vitestExpect(mockJudge).toHaveBeenCalledWith(
      ctx,
      "must have close button",
      judgeConfig,
      "gpt-4o-mini",
      undefined,
    );
  });

  it("passes expectedFiles to judge", async () => {
    setJudgeConfig(judgeConfig);
    const ctx = createMockContext();

    vi.mocked(mockJudge).mockResolvedValue({
      pass: true,
      score: 0.9,
      reason: "files ok",
    });

    await agentExpect(ctx).toPassJudge({
      criteria: "test",
      expectedFiles: ["src/Banner.tsx", "src/Banner.test.tsx"],
    });

    vitestExpect(mockJudge).toHaveBeenCalledWith(ctx, "test", judgeConfig, undefined, [
      "src/Banner.tsx",
      "src/Banner.test.tsx",
    ]);
  });

  it("stores the judge result in the global store", async () => {
    setJudgeConfig(judgeConfig);
    const ctx = createMockContext();

    vi.mocked(mockJudge).mockResolvedValue({
      pass: true,
      score: 0.95,
      reason: "perfect",
    });

    await agentExpect(ctx).toPassJudge({ criteria: "test" });

    const stored = getLastJudgeResult();
    vitestExpect(stored).toEqual({ pass: true, score: 0.95, reason: "perfect" });
  });

  it("throws JudgeFailure when judge returns pass=false", async () => {
    setJudgeConfig(judgeConfig);
    const ctx = createMockContext();

    vi.mocked(mockJudge).mockResolvedValue({
      pass: false,
      score: 0.3,
      reason: "missing close button",
    });

    await vitestExpect(
      agentExpect(ctx).toPassJudge({ criteria: "must have close button" }),
    ).rejects.toThrow("Judge evaluation failed");
  });

  it("includes score and reason in the thrown error", async () => {
    setJudgeConfig(judgeConfig);
    const ctx = createMockContext();

    vi.mocked(mockJudge).mockResolvedValue({
      pass: false,
      score: 0.2,
      reason: "no tests pass",
    });

    try {
      await agentExpect(ctx).toPassJudge({ criteria: "all tests pass" });
      vitestExpect.unreachable("should have thrown");
    } catch (err: unknown) {
      const error = err as Error;
      vitestExpect(error.name).toBe("JudgeFailure");
      vitestExpect(error.message).toContain("0.20");
      vitestExpect(error.message).toContain("no tests pass");
    }
  });
});
