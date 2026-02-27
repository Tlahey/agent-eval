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

import { generateObject } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { judge } from "./judge.js";

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
});
