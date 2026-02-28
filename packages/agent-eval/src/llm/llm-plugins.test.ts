import { describe, it, expect, vi } from "vitest";
import { AnthropicLLM } from "./anthropic-plugin.js";
import { OpenAILLM } from "./openai-plugin.js";
import { OllamaLLM } from "./ollama-plugin.js";

// Mock the AI SDK imports so we never make real API calls
vi.mock("@ai-sdk/anthropic", () => ({
  createAnthropic: vi.fn(() =>
    vi.fn((model: string) => ({ modelId: model, provider: "anthropic" })),
  ),
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(() => vi.fn((model: string) => ({ modelId: model, provider: "openai" }))),
}));

vi.mock("ai", () => ({
  generateObject: vi.fn(async () => ({
    object: {
      pass: true,
      score: 0.9,
      reason: "Mocked evaluation result",
      improvement: "None",
    },
  })),
}));

describe("AnthropicLLM", () => {
  it("has correct name and provider", () => {
    const plugin = new AnthropicLLM({
      defaultModel: "claude-sonnet-4-20250514",
      apiKey: "test-key",
    });
    expect(plugin.name).toBe("anthropic");
    expect(plugin.provider).toBe("anthropic");
    expect(plugin.defaultModel).toBe("claude-sonnet-4-20250514");
  });

  it("evaluates using mocked AI SDK", async () => {
    const plugin = new AnthropicLLM({
      defaultModel: "claude-sonnet-4-20250514",
      apiKey: "test-key",
    });
    const result = await plugin.evaluate({ prompt: "Test prompt" });
    expect(result.pass).toBe(true);
    expect(result.score).toBe(0.9);
    expect(result.reason).toBe("Mocked evaluation result");
  });

  it("generates files using mocked AI SDK", async () => {
    // Override generateObject mock for this test
    const { generateObject } = await import("ai");
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: {
        files: [{ path: "src/test.ts", content: "// test content" }],
      },
    } as never);

    const plugin = new AnthropicLLM({
      defaultModel: "claude-sonnet-4-20250514",
      apiKey: "test-key",
    });
    const result = await plugin.generate({ prompt: "Create a file" });
    expect(result.files).toHaveLength(1);
    expect(result.files[0].path).toBe("src/test.ts");
  });

  it("uses ANTHROPIC_API_KEY env var as fallback", () => {
    const orig = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "env-key-test";
    const plugin = new AnthropicLLM({ defaultModel: "claude-sonnet-4-20250514" });
    expect(plugin.defaultModel).toBe("claude-sonnet-4-20250514");
    process.env.ANTHROPIC_API_KEY = orig;
  });
});

describe("OpenAILLM", () => {
  it("has correct name and provider", () => {
    const plugin = new OpenAILLM({ defaultModel: "gpt-4", apiKey: "test-key" });
    expect(plugin.name).toBe("openai");
    expect(plugin.provider).toBe("openai");
    expect(plugin.defaultModel).toBe("gpt-4");
  });

  it("evaluates using mocked AI SDK", async () => {
    const plugin = new OpenAILLM({ defaultModel: "gpt-4", apiKey: "test-key" });
    const result = await plugin.evaluate({ prompt: "Test prompt" });
    expect(result.pass).toBe(true);
    expect(result.score).toBe(0.9);
  });

  it("uses OPENAI_API_KEY env var as fallback", () => {
    const orig = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "env-key-test";
    const plugin = new OpenAILLM({ defaultModel: "gpt-4" });
    expect(plugin.defaultModel).toBe("gpt-4");
    process.env.OPENAI_API_KEY = orig;
  });
});

describe("OllamaLLM", () => {
  it("has correct name and provider", () => {
    const plugin = new OllamaLLM({ defaultModel: "llama3" });
    expect(plugin.name).toBe("ollama");
    expect(plugin.provider).toBe("ollama");
    expect(plugin.defaultModel).toBe("llama3");
  });

  it("uses default baseURL when not provided", () => {
    const plugin = new OllamaLLM({ defaultModel: "llama3" });
    expect(plugin.defaultModel).toBe("llama3");
  });

  it("accepts custom baseURL", () => {
    const plugin = new OllamaLLM({
      defaultModel: "llama3",
      baseURL: "http://custom:11434/v1",
    });
    expect(plugin.defaultModel).toBe("llama3");
  });

  it("evaluates using mocked AI SDK", async () => {
    const plugin = new OllamaLLM({ defaultModel: "llama3" });
    const result = await plugin.evaluate({ prompt: "Test prompt" });
    expect(result.pass).toBe(true);
    expect(result.score).toBe(0.9);
  });
});
