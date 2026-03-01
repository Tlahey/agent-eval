import { describe, it, expect as vitestExpect, vi, beforeEach } from "vitest";
import {
  expect as agentExpect,
  setJudgeConfig,
  clearJudgeConfig,
  setGlobalThresholds,
  getGlobalThresholds,
} from "./expect.js";
import {
  clearLastJudgeOptions,
  clearLastJudgeResult,
  getLastJudgeOptions,
  getLastJudgeResult,
} from "./runner.js";
import type { TestContext, JudgeConfig } from "./types.js";
import { DEFAULT_THRESHOLDS } from "./types.js";

// Mock the judge module
vi.mock("../judge/judge.js", () => ({
  judge: vi.fn(),
}));

import { judge as mockJudge } from "../judge/judge.js";

function createMockContext(overrides: Partial<TestContext> = {}): TestContext {
  return {
    storeDiff: vi.fn(),
    runCommand: vi.fn(),
    addTask: vi.fn(),
    exec: vi.fn(),
    diff: "diff --git a/test.ts",
    commands: [],
    tasks: [],
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
    clearLastJudgeOptions();
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
      improvement: "none",
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
      improvement: "none",
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
      improvement: "none",
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
      improvement: "No improvement needed.",
    });

    await agentExpect(ctx).toPassJudge({ criteria: "test" });

    const stored = getLastJudgeResult();
    vitestExpect(stored).toEqual({
      pass: true,
      status: "PASS",
      score: 0.95,
      reason: "perfect",
      improvement: "No improvement needed.",
    });
  });

  it("defers judge evaluation when diff is not available yet", async () => {
    setJudgeConfig(judgeConfig);
    const ctx = createMockContext({ diff: null });

    const result = await agentExpect(ctx).toPassJudge({
      criteria: "declarative criteria",
      expectedFiles: ["src/Banner.tsx"],
    });

    vitestExpect(mockJudge).not.toHaveBeenCalled();
    vitestExpect(getLastJudgeOptions()).toEqual({
      criteria: "declarative criteria",
      expectedFiles: ["src/Banner.tsx"],
    });
    vitestExpect(result.reason).toContain("Deferred judge evaluation registered");
  });

  it("throws JudgeFailure when judge returns pass=false", async () => {
    setJudgeConfig(judgeConfig);
    const ctx = createMockContext();

    vi.mocked(mockJudge).mockResolvedValue({
      pass: false,
      score: 0.3,
      reason: "missing close button",
      improvement: "add a close button",
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
      improvement: "fix the tests",
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

  // ─── Threshold tests ───

  it("computes WARN status for score between fail and warn thresholds", async () => {
    setJudgeConfig(judgeConfig);
    const ctx = createMockContext();

    vi.mocked(mockJudge).mockResolvedValue({
      pass: true,
      score: 0.65,
      reason: "partially correct",
      improvement: "needs more work",
    });

    const result = await agentExpect(ctx).toPassJudge({ criteria: "test" });
    vitestExpect(result.status).toBe("WARN");
    vitestExpect(result.pass).toBe(true); // WARN still passes
  });

  it("uses per-test thresholds over global", async () => {
    setJudgeConfig(judgeConfig);
    setGlobalThresholds({ warn: 0.9, fail: 0.7 });
    const ctx = createMockContext();

    vi.mocked(mockJudge).mockResolvedValue({
      pass: true,
      score: 0.75,
      reason: "ok",
      improvement: "none",
    });

    // With global thresholds (warn=0.9, fail=0.7): 0.75 → WARN
    // With per-test thresholds (warn=0.6, fail=0.3): 0.75 → PASS
    const result = await agentExpect(ctx).toPassJudge({
      criteria: "test",
      thresholds: { warn: 0.6, fail: 0.3 },
    });
    vitestExpect(result.status).toBe("PASS");
  });

  it("uses global thresholds when no per-test thresholds", async () => {
    setJudgeConfig(judgeConfig);
    setGlobalThresholds({ warn: 0.95, fail: 0.8 });
    const ctx = createMockContext();

    vi.mocked(mockJudge).mockResolvedValue({
      pass: true,
      score: 0.9,
      reason: "good",
      improvement: "none",
    });

    // score 0.9 with warn=0.95 → WARN
    const result = await agentExpect(ctx).toPassJudge({ criteria: "test" });
    vitestExpect(result.status).toBe("WARN");
  });

  it("resets global thresholds on clearJudgeConfig", () => {
    setGlobalThresholds({ warn: 0.99, fail: 0.9 });
    clearJudgeConfig();
    vitestExpect(getGlobalThresholds()).toEqual(DEFAULT_THRESHOLDS);
  });
});
