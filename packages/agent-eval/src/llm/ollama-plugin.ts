/**
 * Ollama LLM Plugin — uses Vercel AI SDK's @ai-sdk/openai with Ollama-compatible endpoint.
 */

import { BaseLLMPlugin, type BaseLLMOptions } from "./base-plugin.js";

export interface OllamaLLMOptions extends Omit<BaseLLMOptions, "apiKey"> {
  /** Ollama base URL (defaults to http://localhost:11434/v1) */
  baseURL?: string;
}

export class OllamaLLM extends BaseLLMPlugin {
  readonly name = "ollama";
  readonly provider = "ollama";

  constructor(options: OllamaLLMOptions) {
    super({ ...options, apiKey: "ollama" });
    this.baseURL = options.baseURL ?? "http://localhost:11434/v1";
  }

  protected async createModel(modelName: string) {
    const { createOpenAI } = await import("@ai-sdk/openai");
    const provider = createOpenAI({
      baseURL: this.baseURL,
      apiKey: "ollama",
    });
    return provider(modelName);
  }
}
