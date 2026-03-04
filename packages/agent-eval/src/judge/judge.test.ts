import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TestContext, JudgeConfig, ExecutionData } from "../core/types.js";
import type { IModelPlugin, ICliModel } from "../core/interfaces.js";

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
  };
});

// Mock crypto for deterministic temp file names
vi.mock("node:crypto", () => ({
  randomBytes: vi.fn().mockReturnValue({ toString: () => "deadbeef" }),
}));

import { generateObject } from "ai";
import { execSync } from "node:child_process";
import { judge, buildJudgePrompt, extractChangedFiles, extractJsonFromText } from "./judge.js";

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
    runner: { name: "test", model: "test" },
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
    storeDiff: vi.fn(),
    runCommand: vi.fn(),
    addTask: vi.fn(),
    exec: vi.fn(),
    diff: "diff --git a/test.ts b/test.ts\n+const x = 1;",
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
    tasks: [],
    logs: "=== Diff ===\ndiff content\n=== test ===\nTests passed",
    ...overrides,
  };
}

describe("judge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls generateObject with structured schema and returns result", async () => {
    const mockResult = { pass: true, score: 0.9, reason: "well implemented", improvement: "none" };
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

    // Verify the prompt contains the criteria and context
    const callArgs = vi.mocked(generateObject).mock.calls[0][0];
    expect(callArgs.prompt).toContain("has close button");
    expect(callArgs.prompt).toContain("Diff");
  });

  it("resolves model from IModelPlugin", async () => {
    const mockModel = createMockModel("gpt-4o");
    vi.mocked(generateObject).mockResolvedValue({
      object: { pass: true, score: 1, reason: "ok", improvement: "none" },
    } as never);

    const config: JudgeConfig = { model: mockModel };
    await judge(createMockContext(), "criteria", config);

    expect(mockModel.createModel).toHaveBeenCalledOnce();
    expect(generateObject).toHaveBeenCalledOnce();
  });

  it("handles empty context logs", async () => {
    vi.mocked(generateObject).mockResolvedValue({
      object: { pass: false, score: 0.1, reason: "no output", improvement: "add output" },
    } as never);

    const ctx = createMockContext({ logs: "", diff: null, commands: [] });
    const config: JudgeConfig = { model: createMockModel() };
    const prompt = buildJudgePrompt({
      criteria: "criteria",
      execution: createMockExecution({ logs: "", diff: null, changedFiles: [], commands: [] }),
    });

    const { result } = await judge(ctx, prompt, config);
    expect(result.pass).toBe(false);

    const callArgs = vi.mocked(generateObject).mock.calls[0][0];
    expect(callArgs.prompt).toContain("(no logs captured)");
  });

  it("throws when judge has no llm plugin", async () => {
    const config: JudgeConfig = {};

    await expect(judge(createMockContext(), "criteria", config)).rejects.toThrow(
      'Judge requires a "model"',
    );
  });

  it("retries on generateObject failure and succeeds", async () => {
    const mockResult = { pass: true, score: 0.8, reason: "ok", improvement: "none" };
    vi.mocked(generateObject)
      .mockRejectedValueOnce(new Error("Invalid response format"))
      .mockResolvedValueOnce({ object: mockResult } as never);

    const config: JudgeConfig = { model: createMockModel(), maxRetries: 2 };
    const { result } = await judge(createMockContext(), "criteria", config);

    expect(result).toEqual(mockResult);
    expect(generateObject).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting all retries", async () => {
    vi.mocked(generateObject).mockRejectedValue(new Error("Schema validation failed"));

    const config: JudgeConfig = { model: createMockModel(), maxRetries: 1 };

    await expect(judge(createMockContext(), "criteria", config)).rejects.toThrow(
      "Judge failed after 2 attempts",
    );
    // 1 initial + 1 retry = 2 calls
    expect(generateObject).toHaveBeenCalledTimes(2);
  });

  it("defaults to 2 retries when maxRetries is not set", async () => {
    vi.mocked(generateObject).mockRejectedValue(new Error("bad response"));

    const config: JudgeConfig = { model: createMockModel() };

    await expect(judge(createMockContext(), "criteria", config)).rejects.toThrow(
      "Judge failed after 3 attempts",
    );
    // 1 initial + 2 default retries = 3 calls
    expect(generateObject).toHaveBeenCalledTimes(3);
  });

  describe("CLI judge", () => {
    function createCliJudgeModel(overrides: Partial<ICliModel> = {}): ICliModel {
      return {
        type: "cli" as const,
        name: "cli-judge",
        command: 'claude -p "{{prompt}}" --output-format json',
        ...overrides,
      };
    }

    it("executes CLI command and parses JSON result", async () => {
      const judgeResult = { pass: true, score: 0.9, reason: "well done", improvement: "none" };
      vi.mocked(execSync).mockReturnValue(JSON.stringify(judgeResult));

      const config: JudgeConfig = { model: createCliJudgeModel() };
      const { result } = await judge(createMockContext(), "evaluate this", config);

      expect(result).toEqual(judgeResult);
      expect(execSync).toHaveBeenCalledOnce();
      expect(generateObject).not.toHaveBeenCalled();
    });

    it("replaces {{prompt}} in CLI command with temp file", async () => {
      vi.mocked(execSync).mockReturnValue(
        JSON.stringify({ pass: true, score: 1, reason: "ok", improvement: "" }),
      );

      const config: JudgeConfig = { model: createCliJudgeModel() };
      await judge(createMockContext(), "my test prompt", config);

      const calledCmd = vi.mocked(execSync).mock.calls[0][0] as string;
      expect(calledCmd).toContain("$(cat ");
      expect(calledCmd).toContain(".judge-prompt-deadbeef.txt");
      expect(calledCmd).not.toContain("{{prompt}}");
    });

    it("uses parseOutput when provided on CLI model", async () => {
      const rawJson = {
        result: { pass: true, score: 0.8, reason: "good", improvement: "none" },
        extra: "data",
      };
      vi.mocked(execSync).mockReturnValue(JSON.stringify(rawJson));

      const parseOutput = vi.fn().mockReturnValue({
        agentOutput: JSON.stringify(rawJson.result),
      });

      const config: JudgeConfig = {
        model: createCliJudgeModel({ parseOutput }),
      };
      const { result } = await judge(createMockContext(), "prompt", config);

      expect(parseOutput).toHaveBeenCalledOnce();
      expect(result.score).toBe(0.8);
    });

    it("throws on invalid JSON from CLI", async () => {
      vi.mocked(execSync).mockReturnValue("not valid json");

      const config: JudgeConfig = { model: createCliJudgeModel(), maxRetries: 0 };

      await expect(judge(createMockContext(), "prompt", config)).rejects.toThrow(
        "CLI judge output is not valid JSON",
      );
    });

    it("throws on missing required fields", async () => {
      vi.mocked(execSync).mockReturnValue(JSON.stringify({ foo: "bar" }));

      const config: JudgeConfig = { model: createCliJudgeModel(), maxRetries: 0 };

      await expect(judge(createMockContext(), "prompt", config)).rejects.toThrow(
        "CLI judge JSON missing required fields",
      );
    });

    it("retries CLI judge on failure", async () => {
      vi.mocked(execSync)
        .mockImplementationOnce(() => {
          throw Object.assign(new Error("timeout"), { stdout: "", stderr: "timeout", status: 1 });
        })
        .mockReturnValueOnce(
          JSON.stringify({ pass: true, score: 0.7, reason: "ok", improvement: "" }),
        );

      const config: JudgeConfig = { model: createCliJudgeModel(), maxRetries: 1 };
      const { result } = await judge(createMockContext(), "prompt", config);

      expect(result.score).toBe(0.7);
      expect(execSync).toHaveBeenCalledTimes(2);
    });

    it("defaults pass based on score when pass field is missing", async () => {
      vi.mocked(execSync).mockReturnValue(
        JSON.stringify({ score: 0.3, reason: "poor", improvement: "try harder" }),
      );

      const config: JudgeConfig = { model: createCliJudgeModel() };
      const { result } = await judge(createMockContext(), "prompt", config);

      expect(result.pass).toBe(false); // 0.3 < 0.5
      expect(result.score).toBe(0.3);
    });
  });
});

describe("extractChangedFiles", () => {
  it("extracts file paths from a git diff", () => {
    const diff = `diff --git a/src/Banner.tsx b/src/Banner.tsx
index abc..def 100644
--- a/src/Banner.tsx
+++ b/src/Banner.tsx
@@ -1,3 +1,5 @@
+import React from 'react';
diff --git a/src/Banner.test.tsx b/src/Banner.test.tsx
index 123..456 100644`;
    const files = extractChangedFiles(diff);
    expect(files).toEqual(["src/Banner.tsx", "src/Banner.test.tsx"]);
  });

  it("returns empty array for null diff", () => {
    expect(extractChangedFiles(null)).toEqual([]);
  });

  it("returns empty array for empty diff", () => {
    expect(extractChangedFiles("")).toEqual([]);
  });
});

describe("buildJudgePrompt - expectedFiles", () => {
  it("includes file scope section when expectedFiles are provided", () => {
    const diff = "diff --git a/src/Banner.tsx b/src/Banner.tsx\n+code";
    const prompt = buildJudgePrompt({
      criteria: "criteria",
      execution: createMockExecution({
        diff,
        changedFiles: ["src/Banner.tsx"],
      }),
      expectedFiles: ["src/Banner.tsx", "src/Banner.test.tsx"],
    });

    expect(prompt).toContain("File Scope Analysis");
    expect(prompt).toContain("src/Banner.tsx");
    expect(prompt).toContain("Missing expected files");
    expect(prompt).toContain("src/Banner.test.tsx");
  });

  it("does not include file scope when no expectedFiles", () => {
    const prompt = buildJudgePrompt({ criteria: "criteria", execution: createMockExecution() });
    expect(prompt).not.toContain("File Scope Analysis");
  });

  it("flags unexpected file changes", () => {
    const diff =
      "diff --git a/src/Banner.tsx b/src/Banner.tsx\n+code\ndiff --git a/package.json b/package.json\n+dep";
    const prompt = buildJudgePrompt({
      criteria: "criteria",
      execution: createMockExecution({
        diff,
        changedFiles: ["src/Banner.tsx", "package.json"],
      }),
      expectedFiles: ["src/Banner.tsx"],
    });

    expect(prompt).toContain("Unexpected file changes");
    expect(prompt).toContain("package.json");
  });

  it("shows no warnings when all expected files match", () => {
    const diff =
      "diff --git a/src/A.tsx b/src/A.tsx\n+code\ndiff --git a/src/B.tsx b/src/B.tsx\n+code";
    const prompt = buildJudgePrompt({
      criteria: "criteria",
      execution: createMockExecution({
        diff,
        changedFiles: ["src/A.tsx", "src/B.tsx"],
      }),
      expectedFiles: ["src/A.tsx", "src/B.tsx"],
    });

    expect(prompt).toContain("File Scope Analysis");
    expect(prompt).not.toContain("⚠️ **Missing expected files:**");
    expect(prompt).not.toContain("⚠️ **Unexpected file changes:**");
  });
});

describe("buildJudgePrompt - unified adaptive prompt", () => {
  it("includes instruction section when provided", () => {
    const prompt = buildJudgePrompt({
      criteria: "test criteria",
      execution: createMockExecution({
        instruction: "Add a close button to the Banner component",
      }),
    });

    expect(prompt).toContain("## Agent Instruction");
    expect(prompt).toContain("Add a close button to the Banner component");
    expect(prompt).toContain("test criteria");
  });

  it("excludes instruction section when not provided", () => {
    const prompt = buildJudgePrompt({ criteria: "criteria", execution: createMockExecution() });

    expect(prompt).not.toContain("## Agent Instruction");
  });

  it("includes task results section with weights when tasks provided", () => {
    const taskAction = async () => ({
      name: "x",
      command: "x",
      stdout: "",
      stderr: "",
      exitCode: 0,
      durationMs: 0,
    });
    const prompt = buildJudgePrompt({
      criteria: "criteria",
      execution: createMockExecution({
        taskResults: [
          {
            task: { name: "Tests", action: taskAction, criteria: "All tests pass", weight: 3 },
            result: {
              name: "Tests",
              command: "pnpm test",
              stdout: "All tests passed",
              stderr: "",
              exitCode: 0,
              durationMs: 100,
            },
          },
          {
            task: { name: "Build", action: taskAction, criteria: "Build succeeds", weight: 1 },
            result: {
              name: "Build",
              command: "pnpm build",
              stdout: "Build succeeded",
              stderr: "",
              exitCode: 0,
              durationMs: 200,
            },
          },
        ],
      }),
    });

    expect(prompt).toContain("## Task Results (2 tasks, total weight: 4)");
    expect(prompt).toContain("Task 1: Tests (weight: 3)");
    expect(prompt).toContain("Task 2: Build (weight: 1)");
    expect(prompt).toContain("All tests passed");
    expect(prompt).toContain("Weight the scores accordingly");
  });

  it("excludes task section when no tasks provided", () => {
    const prompt = buildJudgePrompt({ criteria: "criteria", execution: createMockExecution() });

    expect(prompt).not.toContain("## Task Results");
    expect(prompt).not.toContain("Weight the scores accordingly");
  });

  it("includes all sections when fully populated", () => {
    const diff = "diff --git a/src/Banner.tsx b/src/Banner.tsx\n+code";
    const taskAction = async () => ({
      name: "x",
      command: "x",
      stdout: "",
      stderr: "",
      exitCode: 0,
      durationMs: 0,
    });

    const prompt = buildJudgePrompt({
      criteria: "component quality",
      execution: createMockExecution({
        instruction: "Add close button",
        diff,
        changedFiles: ["src/Banner.tsx"],
        taskResults: [
          {
            task: { name: "Tests", action: taskAction, criteria: "pass", weight: 2 },
            result: {
              name: "Tests",
              command: "test",
              stdout: "ok",
              stderr: "",
              exitCode: 0,
              durationMs: 0,
            },
          },
        ],
      }),
      expectedFiles: ["src/Banner.tsx"],
    });

    expect(prompt).toContain("## Evaluation Criteria");
    expect(prompt).toContain("## Agent Instruction");
    expect(prompt).toContain("## Task Results");
    expect(prompt).toContain("## Code Changes");
    expect(prompt).toContain("## File Scope Analysis");
    expect(prompt).toContain("## Scoring Instructions");
  });

  it("works with the object overload", () => {
    const prompt = buildJudgePrompt({ criteria: "test", execution: createMockExecution() });

    expect(prompt).toContain("## Evaluation Criteria");
    expect(prompt).toContain("test");
    expect(prompt).toContain("## Scoring Instructions");
  });
});

describe("extractJsonFromText", () => {
  it("returns null for empty text", () => {
    expect(extractJsonFromText("")).toBeNull();
  });

  it("extracts JSON from markdown fenced block", () => {
    const text = `Here is my evaluation:\n\`\`\`json\n{"score": 0.8, "reason": "good"}\n\`\`\`\nHope that helps!`;
    const result = extractJsonFromText(text);
    expect(result).toBe('{"score": 0.8, "reason": "good"}');
  });

  it("extracts JSON from unfenced block with expected fields", () => {
    const text = `The evaluation result is: {"pass": true, "score": 0.9, "reason": "well done", "improvement": "none"}. That's my assessment.`;
    const result = extractJsonFromText(text);
    expect(result).not.toBeNull();
    const parsed = JSON.parse(result!);
    expect(parsed.score).toBe(0.9);
  });

  it("extracts generic JSON object", () => {
    const text = `Output: {"key": "value"} done.`;
    const result = extractJsonFromText(text);
    expect(result).toBe('{"key": "value"}');
  });

  it("returns null for text with no JSON", () => {
    expect(extractJsonFromText("just plain text")).toBeNull();
  });
});
