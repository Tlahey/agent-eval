/**
 * OpenAI LLM Plugin — uses Vercel AI SDK's @ai-sdk/openai.
 */

import { BaseLLMPlugin, type BaseLLMOptions } from "./base-plugin.js";

export interface OpenAILLMOptions extends BaseLLMOptions {
  /** Defaults to OPENAI_API_KEY env var */
  apiKey?: string;
}

export class OpenAILLM extends BaseLLMPlugin {
  readonly name = "openai";
  readonly provider = "openai";

  constructor(options: OpenAILLMOptions) {
    super(options);
    this.apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  }

  protected async createModel(modelName: string) {
    const { createOpenAI } = await import("@ai-sdk/openai");
    const provider = createOpenAI({
      apiKey: this.apiKey,
      ...(this.baseURL ? { baseURL: this.baseURL } : {}),
    });
    return provider(modelName);
  }
}
