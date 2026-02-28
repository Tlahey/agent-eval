/**
 * Anthropic LLM Plugin — uses Vercel AI SDK's @ai-sdk/anthropic.
 */

import { BaseLLMPlugin, type BaseLLMOptions } from "./base-plugin.js";

export interface AnthropicLLMOptions extends BaseLLMOptions {
  /** Defaults to ANTHROPIC_API_KEY env var */
  apiKey?: string;
}

export class AnthropicLLM extends BaseLLMPlugin {
  readonly name = "anthropic";
  readonly provider = "anthropic";

  constructor(options: AnthropicLLMOptions) {
    super(options);
    this.apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
  }

  protected async createModel(modelName: string) {
    const { createAnthropic } = await import("@ai-sdk/anthropic");
    const provider = createAnthropic({
      apiKey: this.apiKey,
      ...(this.baseURL ? { baseURL: this.baseURL } : {}),
    });
    return provider(modelName);
  }
}
