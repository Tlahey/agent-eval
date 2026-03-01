import { describe, it, expect, vi } from "vitest";
import { AnthropicModel } from "./anthropic.js";
import { OpenAIModel } from "./openai.js";
import { OllamaModel } from "./ollama.js";

// Mock AI SDK providers
vi.mock("@ai-sdk/anthropic", () => ({
  createAnthropic: vi.fn(() => (model: string) => ({ modelId: model, provider: "anthropic-mock" })),
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(() => (model: string) => ({ modelId: model, provider: "openai-mock" })),
}));

import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";

describe("AnthropicModel", () => {
  it("has correct name and modelId", () => {
    const model = new AnthropicModel({ model: "claude-sonnet-4-20250514" });
    expect(model.name).toBe("anthropic");
    expect(model.modelId).toBe("claude-sonnet-4-20250514");
  });

  it("creates model via @ai-sdk/anthropic", async () => {
    const model = new AnthropicModel({ model: "claude-sonnet-4-20250514" });
    const result = await model.createModel();

    expect(createAnthropic).toHaveBeenCalledWith(expect.objectContaining({}));
    expect(result).toBeDefined();
  });

  it("passes apiKey and baseURL to provider", async () => {
    const model = new AnthropicModel({
      model: "claude-sonnet-4-20250514",
      apiKey: "sk-custom",
      baseURL: "https://custom.api.com",
    });
    await model.createModel();

    expect(createAnthropic).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "sk-custom",
        baseURL: "https://custom.api.com",
      }),
    );
  });
});

describe("OpenAIModel", () => {
  it("has correct name and modelId", () => {
    const model = new OpenAIModel({ model: "gpt-4o" });
    expect(model.name).toBe("openai");
    expect(model.modelId).toBe("gpt-4o");
  });

  it("creates model via @ai-sdk/openai", async () => {
    const model = new OpenAIModel({ model: "gpt-4o" });
    const result = await model.createModel();

    expect(createOpenAI).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it("passes apiKey and baseURL to provider", async () => {
    const model = new OpenAIModel({
      model: "gpt-4o",
      apiKey: "sk-test",
      baseURL: "https://api.custom.com/v1",
    });
    await model.createModel();

    expect(createOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "sk-test",
        baseURL: "https://api.custom.com/v1",
      }),
    );
  });
});

describe("OllamaModel", () => {
  it("has correct name and modelId", () => {
    const model = new OllamaModel({ model: "llama3" });
    expect(model.name).toBe("ollama");
    expect(model.modelId).toBe("llama3");
  });

  it("creates model via @ai-sdk/openai with ollama baseURL", async () => {
    const model = new OllamaModel({ model: "llama3" });
    await model.createModel();

    expect(createOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: "http://localhost:11434/v1",
        apiKey: "ollama",
      }),
    );
  });

  it("allows custom baseURL override", async () => {
    const model = new OllamaModel({
      model: "llama3",
      baseURL: "http://remote:11434/v1",
    });
    await model.createModel();

    expect(createOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: "http://remote:11434/v1",
      }),
    );
  });
});
