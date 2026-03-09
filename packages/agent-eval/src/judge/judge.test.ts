import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TestContext, JudgeConfig, ExecutionData, JudgeResult } from "../core/types.js";
import type { IModelPlugin } from "../core/interfaces.js";

// Mock the AI SDK
vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));

// Mock child_process for CLI judge tests
vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

// Mock fs for temp file operations in CLI judge
vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
    mkdirSync: vi.fn(),
    existsSync: vi.fn().mockReturnValue(true),
  };
});

// Mock crypto for deterministic temp file names
vi.mock("node:crypto", () => ({
  randomBytes: vi.fn().mockReturnValue({ toString: () => "deadbeef" }),
}));

import { generateObject } from "ai";
import { judge, buildJudgePrompt } from "./judge.js";

function createMockModel(modelId = "test-model"): IModelPlugin {
  return {
    name: "mock",
    modelId,
    createModel: vi.fn().mockResolvedValue({ modelId, provider: "mock" }),
  };
}

function createMockExecution(overrides: Partial<ExecutionData> = {}): ExecutionData {
  return {
    instruction: "",
    runner: { id: "test", model: "test" },
    diff: "diff --git a/test.ts b/test.ts\n+const x = 1;",
    changedFiles: ["test.ts"],
    commands: [
      {
        name: "test",
        command: "pnpm test",
        stdout: "Tests passed",
        stderr: "",
        exitCode: 0,
        durationMs: 500,
      },
    ],
    taskResults: [],
    timing: { totalMs: 0 },
    logs: "=== Diff ===\ndiff content\n=== test ===\nTests passed",
    ...overrides,
  };
}

function createMockContext(overrides: Partial<TestContext> = {}): TestContext {
  return {
    cwd: "/mock/cwd",
    instruction: "test",
    diff: "diff --git a/test.ts b/test.ts\n+const x = 1;",
    commands: [],
    tasks: [],
    logs: "logs",
    prompt: vi.fn(),
    setInstruction: vi.fn(),
    setRunnerInfo: vi.fn(),
    setAgentOutput: vi.fn(),
    setAgentTokenUsage: vi.fn(),
    addTask: vi.fn(),
    runCommand: vi.fn(),
    storeDiff: vi.fn(),
    storeDiffAsync: vi.fn(),
    buildExecutionData: vi.fn(),
    ...overrides,
  };
}

describe("judge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls generateObject with structured schema and returns result", async () => {
    const mockResult: JudgeResult = {
      pass: true,
      score: 0.9,
      status: "PASS",
      reason: "well implemented",
      improvement: "none",
    };
    vi.mocked(generateObject).mockResolvedValue({
      object: mockResult,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      toJsonResponse: vi.fn(),
      rawResponse: undefined,
      response: undefined,
      warnings: undefined,
      request: undefined,
      experimental_providerMetadata: undefined,
      providerMetadata: undefined,
      finishReason: "stop",
    } as never);

    const config: JudgeConfig = { model: createMockModel("claude-sonnet-4-20250514") };
    const ctx = createMockContext();
    const prompt = buildJudgePrompt({
      criteria: "has close button",
      execution: createMockExecution(),
    });

    const { result } = await judge(ctx, prompt, config);

    expect(result).toEqual(mockResult);
    expect(generateObject).toHaveBeenCalledOnce();
  });

  it("throws when judge has no model", async () => {
    const config: JudgeConfig = { model: undefined as any };
    await expect(judge(createMockContext(), "criteria", config)).rejects.toThrow(
      'Judge requires a "model"',
    );
  });
});
