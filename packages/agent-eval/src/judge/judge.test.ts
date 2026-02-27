import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TestContext, JudgeConfig } from "../core/types.js";

// Mock the AI SDK
vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));

vi.mock("@ai-sdk/anthropic", () => ({
  createAnthropic: vi.fn(() => (model: string) => ({ modelId: model, provider: "anthropic" })),
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(() => (model: string) => ({ modelId: model, provider: "openai" })),
}));

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

vi.mock("node:fs", () => ({
  writeFileSync: vi.fn(),
  mkdtempSync: vi.fn(() => "/tmp/agenteval-judge-mock"),
  rmSync: vi.fn(),
}));

import { generateObject } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { execSync } from "node:child_process";
import { judge, extractJudgeJson, buildJudgePrompt, extractChangedFiles } from "./judge.js";

function createMockContext(overrides: Partial<TestContext> = {}): TestContext {
  return {
    storeDiff: vi.fn(),
    runCommand: vi.fn(),
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
    logs: "=== Diff ===\ndiff content\n=== test ===\nTests passed",
    ...overrides,
  };
}

describe("judge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls generateObject with structured schema and returns result", async () => {
    const mockResult = { pass: true, score: 0.9, reason: "well implemented" };
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

    const config: JudgeConfig = { provider: "anthropic", model: "claude-sonnet-4-20250514" };
    const ctx = createMockContext();

    const result = await judge(ctx, "has close button", config);

    expect(result).toEqual(mockResult);
    expect(generateObject).toHaveBeenCalledOnce();

    // Verify the prompt contains the criteria and context
    const callArgs = vi.mocked(generateObject).mock.calls[0][0];
    expect(callArgs.prompt).toContain("has close button");
    expect(callArgs.prompt).toContain("Diff");
  });

  it("resolves anthropic provider", async () => {
    vi.mocked(generateObject).mockResolvedValue({
      object: { pass: true, score: 1, reason: "ok" },
    } as never);

    const config: JudgeConfig = { provider: "anthropic", model: "claude-sonnet-4-20250514" };
    await judge(createMockContext(), "criteria", config);

    expect(createAnthropic).toHaveBeenCalled();
  });

  it("resolves openai provider", async () => {
    vi.mocked(generateObject).mockResolvedValue({
      object: { pass: true, score: 0.8, reason: "good" },
    } as never);

    const config: JudgeConfig = { provider: "openai", model: "gpt-4o" };
    await judge(createMockContext(), "criteria", config);

    expect(createOpenAI).toHaveBeenCalled();
  });

  it("resolves ollama provider with default baseURL", async () => {
    vi.mocked(generateObject).mockResolvedValue({
      object: { pass: true, score: 0.7, reason: "decent" },
    } as never);

    const config: JudgeConfig = { provider: "ollama", model: "llama3" };
    await judge(createMockContext(), "criteria", config);

    expect(createOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: "http://localhost:11434/v1",
        apiKey: "ollama",
      }),
    );
  });

  it("uses model override when provided", async () => {
    vi.mocked(generateObject).mockResolvedValue({
      object: { pass: true, score: 0.85, reason: "nice" },
    } as never);

    const config: JudgeConfig = { provider: "openai", model: "gpt-4o" };
    await judge(createMockContext(), "criteria", config, "gpt-4o-mini");

    // Since our mock returns a function, it was called — we verify generateObject was called
    expect(generateObject).toHaveBeenCalledOnce();
  });

  it("throws for unsupported provider", async () => {
    const config = { provider: "unsupported" as never, model: "test" };

    await expect(judge(createMockContext(), "criteria", config)).rejects.toThrow(
      "Unsupported judge provider",
    );
  });

  it("handles empty context logs", async () => {
    vi.mocked(generateObject).mockResolvedValue({
      object: { pass: false, score: 0.1, reason: "no output" },
    } as never);

    const ctx = createMockContext({ logs: "", diff: null, commands: [] });
    const config: JudgeConfig = { provider: "anthropic", model: "claude-sonnet-4-20250514" };

    const result = await judge(ctx, "criteria", config);
    expect(result.pass).toBe(false);

    const callArgs = vi.mocked(generateObject).mock.calls[0][0];
    expect(callArgs.prompt).toContain("(no logs captured)");
  });

  it("passes custom apiKey and baseURL to provider", async () => {
    vi.mocked(generateObject).mockResolvedValue({
      object: { pass: true, score: 0.9, reason: "ok" },
    } as never);

    const config: JudgeConfig = {
      provider: "openai",
      model: "gpt-4o",
      apiKey: "sk-custom",
      baseURL: "https://custom.api.com/v1",
    };
    await judge(createMockContext(), "criteria", config);

    expect(createOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "sk-custom",
        baseURL: "https://custom.api.com/v1",
      }),
    );
  });

  it("throws when API judge missing provider or model", async () => {
    const config: JudgeConfig = { type: "api" };

    await expect(judge(createMockContext(), "criteria", config)).rejects.toThrow(
      'API judge requires "provider" and "model"',
    );
  });
});

describe("judge - CLI mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("executes CLI command and parses JSON result", async () => {
    const mockResult = JSON.stringify({ pass: true, score: 0.85, reason: "looks good" });
    vi.mocked(execSync).mockReturnValue(mockResult);

    const config: JudgeConfig = {
      type: "cli",
      command: 'claude -p "{{prompt}}" --output-format json',
    };

    const result = await judge(createMockContext(), "has unit tests", config);

    expect(result).toEqual({ pass: true, score: 0.85, reason: "looks good" });
    expect(execSync).toHaveBeenCalledOnce();
  });

  it("extracts JSON from mixed CLI output", async () => {
    const output = `Thinking...\n{"pass": false, "score": 0.3, "reason": "missing tests"}\nDone.`;
    vi.mocked(execSync).mockReturnValue(output);

    const config: JudgeConfig = {
      type: "cli",
      command: "some-cli evaluate",
    };

    const result = await judge(createMockContext(), "criteria", config);

    expect(result.pass).toBe(false);
    expect(result.score).toBe(0.3);
    expect(result.reason).toBe("missing tests");
  });

  it("replaces {{prompt_file}} with temp file path", async () => {
    vi.mocked(execSync).mockReturnValue(
      JSON.stringify({ pass: true, score: 1, reason: "perfect" }),
    );

    const config: JudgeConfig = {
      type: "cli",
      command: "judge-cli --input {{prompt_file}}",
    };

    await judge(createMockContext(), "criteria", config);

    const calledCmd = vi.mocked(execSync).mock.calls[0][0] as string;
    expect(calledCmd).toContain("/tmp/agenteval-judge-mock/prompt.txt");
    expect(calledCmd).not.toContain("{{prompt_file}}");
  });

  it("throws when CLI judge has no command", async () => {
    const config: JudgeConfig = { type: "cli" };

    await expect(judge(createMockContext(), "criteria", config)).rejects.toThrow(
      'CLI judge requires a "command" field',
    );
  });

  it("throws after all retries when CLI output has no valid JSON", async () => {
    vi.mocked(execSync).mockReturnValue("I could not evaluate this code.");

    const config: JudgeConfig = {
      type: "cli",
      command: "bad-cli evaluate",
      maxRetries: 1,
    };

    await expect(judge(createMockContext(), "criteria", config)).rejects.toThrow(
      "does not contain valid JSON",
    );

    // 1 initial attempt + 1 retry = 2 calls
    expect(execSync).toHaveBeenCalledTimes(2);
  });

  it("retries on invalid JSON then succeeds", async () => {
    vi.mocked(execSync)
      .mockReturnValueOnce("Not JSON at all")
      .mockReturnValueOnce(JSON.stringify({ pass: true, score: 0.9, reason: "ok on retry" }));

    const config: JudgeConfig = {
      type: "cli",
      command: "flaky-cli evaluate",
      maxRetries: 2,
    };

    const result = await judge(createMockContext(), "criteria", config);

    expect(result).toEqual({ pass: true, score: 0.9, reason: "ok on retry" });
    expect(execSync).toHaveBeenCalledTimes(2);
  });

  it("does not retry on command execution failure", async () => {
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error("Command not found: bad-cli");
    });

    const config: JudgeConfig = {
      type: "cli",
      command: "bad-cli evaluate",
      maxRetries: 3,
    };

    await expect(judge(createMockContext(), "criteria", config)).rejects.toThrow(
      "Command not found",
    );

    // No retry — command failure, not JSON validation
    expect(execSync).toHaveBeenCalledTimes(1);
  });

  it("defaults to 2 retries when maxRetries is not set", async () => {
    vi.mocked(execSync).mockReturnValue("garbage output");

    const config: JudgeConfig = {
      type: "cli",
      command: "cli evaluate",
    };

    await expect(judge(createMockContext(), "criteria", config)).rejects.toThrow(
      "does not contain valid JSON",
    );

    // 1 initial + 2 default retries = 3 calls
    expect(execSync).toHaveBeenCalledTimes(3);
  });
});

describe("extractJudgeJson", () => {
  it("parses clean JSON", () => {
    const result = extractJudgeJson('{"pass": true, "score": 0.9, "reason": "good"}');
    expect(result).toEqual({ pass: true, score: 0.9, reason: "good" });
  });

  it("strips markdown code fences", () => {
    const output = '```json\n{"pass": false, "score": 0.2, "reason": "bad"}\n```';
    const result = extractJudgeJson(output);
    expect(result).toEqual({ pass: false, score: 0.2, reason: "bad" });
  });

  it("extracts JSON from preamble text", () => {
    const output = 'Here is my evaluation:\n{"pass": true, "score": 0.8, "reason": "decent"}\nEnd.';
    const result = extractJudgeJson(output);
    expect(result.score).toBe(0.8);
  });

  it("throws on missing JSON", () => {
    expect(() => extractJudgeJson("No JSON here")).toThrow("does not contain valid JSON");
  });

  it("throws on malformed JSON", () => {
    expect(() => extractJudgeJson('{"pass": true, "score": bad, "reason": "x"}')).toThrow(
      "malformed JSON",
    );
  });

  it("throws on invalid schema (score out of range)", () => {
    expect(() => extractJudgeJson('{"pass": true, "score": 5.0, "reason": "too high"}')).toThrow();
  });

  it("throws on missing required field", () => {
    expect(() => extractJudgeJson('{"pass": true, "score": 0.5}')).toThrow();
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
    const ctx = createMockContext({
      diff: "diff --git a/src/Banner.tsx b/src/Banner.tsx\n+code",
    });

    const prompt = buildJudgePrompt("criteria", ctx, ["src/Banner.tsx", "src/Banner.test.tsx"]);

    expect(prompt).toContain("File Scope Analysis");
    expect(prompt).toContain("src/Banner.tsx");
    expect(prompt).toContain("Missing expected files");
    expect(prompt).toContain("src/Banner.test.tsx");
  });

  it("does not include file scope when no expectedFiles", () => {
    const ctx = createMockContext();
    const prompt = buildJudgePrompt("criteria", ctx);
    expect(prompt).not.toContain("File Scope Analysis");
  });

  it("flags unexpected file changes", () => {
    const ctx = createMockContext({
      diff: "diff --git a/src/Banner.tsx b/src/Banner.tsx\n+code\ndiff --git a/package.json b/package.json\n+dep",
    });

    const prompt = buildJudgePrompt("criteria", ctx, ["src/Banner.tsx"]);

    expect(prompt).toContain("Unexpected file changes");
    expect(prompt).toContain("package.json");
  });

  it("shows no warnings when all expected files match", () => {
    const ctx = createMockContext({
      diff: "diff --git a/src/A.tsx b/src/A.tsx\n+code\ndiff --git a/src/B.tsx b/src/B.tsx\n+code",
    });

    const prompt = buildJudgePrompt("criteria", ctx, ["src/A.tsx", "src/B.tsx"]);

    expect(prompt).toContain("File Scope Analysis");
    expect(prompt).not.toContain("⚠️ **Missing expected files:**");
    expect(prompt).not.toContain("⚠️ **Unexpected file changes:**");
  });
});
