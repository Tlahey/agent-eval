import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from "vitest";
import { AnthropicModel } from "./anthropic.js";
import { OpenAIModel } from "./openai.js";
import { OllamaModel } from "./ollama.js";
import { GitHubModelsModel } from "./github-models.js";

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

describe("GitHubModelsModel", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  it("has correct name and modelId", () => {
    const model = new GitHubModelsModel({ model: "openai/gpt-5-mini" });
    expect(model.name).toBe("github-models");
    expect(model.modelId).toBe("openai/gpt-5-mini");
  });

  it("defaults to openai/gpt-4o", () => {
    const model = new GitHubModelsModel();
    expect(model.modelId).toBe("openai/gpt-4o");
  });

  it("creates model via @ai-sdk/openai with GitHub Models baseURL", async () => {
    process.env.GH_COPILOT_TOKEN = "ghp_test123";
    const model = new GitHubModelsModel({ model: "openai/gpt-5-mini" });
    await model.createModel();

    expect(createOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: "https://models.github.ai/inference",
        apiKey: "ghp_test123",
      }),
    );
  });

  it("falls back to GITHUB_TOKEN when GH_COPILOT_TOKEN is not set", async () => {
    delete process.env.GH_COPILOT_TOKEN;
    process.env.GITHUB_TOKEN = "gho_fallback";
    const model = new GitHubModelsModel({ model: "openai/gpt-4o" });
    await model.createModel();

    expect(createOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "gho_fallback",
      }),
    );
  });

  it("prefers explicit token over env vars", async () => {
    process.env.GH_COPILOT_TOKEN = "ghp_env";
    const model = new GitHubModelsModel({
      model: "openai/gpt-5-mini",
      token: "ghp_explicit",
    });
    await model.createModel();

    expect(createOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "ghp_explicit",
      }),
    );
  });

  it("throws when no token is available", async () => {
    delete process.env.GH_COPILOT_TOKEN;
    delete process.env.GITHUB_TOKEN;
    const model = new GitHubModelsModel({ model: "openai/gpt-5-mini" });

    await expect(model.createModel()).rejects.toThrow("GitHub Models requires a token");
  });

  it("allows custom baseURL", async () => {
    process.env.GH_COPILOT_TOKEN = "ghp_test";
    const model = new GitHubModelsModel({
      model: "openai/gpt-5-mini",
      baseURL: "https://custom.models.api/v1",
    });
    await model.createModel();

    expect(createOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: "https://custom.models.api/v1",
      }),
    );
  });

  it("stores generation settings (temperature, maxTokens, topP)", () => {
    const model = new GitHubModelsModel({
      model: "openai/gpt-5-mini",
      settings: { temperature: 1, maxTokens: 4096, topP: 1 },
    });
    expect(model.settings).toEqual({
      temperature: 1,
      maxTokens: 4096,
      topP: 1,
    });
  });

  it("has undefined settings when not provided", () => {
    const model = new GitHubModelsModel({ model: "openai/gpt-4o" });
    expect(model.settings).toBeUndefined();
  });

  it("enables structuredOutputs for guaranteed JSON", async () => {
    process.env.GH_COPILOT_TOKEN = "ghp_test";
    const mockProvider = vi.fn((_model: string, _opts?: unknown) => ({
      modelId: _model,
      provider: "openai-mock",
    }));
    vi.mocked(createOpenAI).mockReturnValueOnce(
      mockProvider as unknown as ReturnType<typeof createOpenAI>,
    );

    const model = new GitHubModelsModel({ model: "openai/gpt-5-mini" });
    await model.createModel();

    expect(mockProvider).toHaveBeenCalledWith("openai/gpt-5-mini", { structuredOutputs: true });
  });

  // Restore env
  afterAll(() => {
    process.env = originalEnv;
  });
});

describe("CliModel", () => {
  let CliModel: typeof import("./cli.js").CliModel;

  beforeAll(async () => {
    ({ CliModel } = await import("./cli.js"));
  });

  it("has correct type, name, and command", () => {
    const model = new CliModel({ command: 'aider --message "{{prompt}}" --yes' });
    expect(model.type).toBe("cli");
    expect(model.name).toBe("cli");
    expect(model.command).toBe('aider --message "{{prompt}}" --yes');
  });

  it("allows custom name", () => {
    const model = new CliModel({ command: "echo {{prompt}}", name: "echo-runner" });
    expect(model.name).toBe("echo-runner");
  });

  it("defaults name to cli", () => {
    const model = new CliModel({ command: "echo {{prompt}}" });
    expect(model.name).toBe("cli");
  });

  it("has no parseOutput by default", () => {
    const model = new CliModel({ command: "echo {{prompt}}" });
    expect(model.parseOutput).toBeUndefined();
  });

  it("accepts a parseOutput function for token extraction", () => {
    const model = new CliModel({
      command: 'claude -p "{{prompt}}" --output-format json',
      name: "claude-code",
      parseOutput: ({ stdout }) => {
        const json = JSON.parse(stdout);
        return {
          tokenUsage: {
            inputTokens: json.usage.input_tokens,
            outputTokens: json.usage.output_tokens,
            totalTokens: json.usage.input_tokens + json.usage.output_tokens,
          },
          agentOutput: json.result,
        };
      },
    });

    expect(model.parseOutput).toBeDefined();
    const metrics = model.parseOutput!({
      stdout: JSON.stringify({
        result: "Files updated",
        usage: { input_tokens: 2000, output_tokens: 800 },
      }),
      stderr: "",
    });
    expect(metrics.tokenUsage).toEqual({
      inputTokens: 2000,
      outputTokens: 800,
      totalTokens: 2800,
    });
    expect(metrics.agentOutput).toBe("Files updated");
  });

  it("parseOutput can return empty metrics for CLIs without token data", () => {
    const model = new CliModel({
      command: 'gh copilot suggest "{{prompt}}"',
      name: "copilot",
      parseOutput: () => ({}),
    });

    const metrics = model.parseOutput!({ stdout: "some output", stderr: "" });
    expect(metrics.tokenUsage).toBeUndefined();
    expect(metrics.agentOutput).toBeUndefined();
  });
});
