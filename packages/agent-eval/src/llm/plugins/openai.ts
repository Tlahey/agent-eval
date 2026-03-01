import type { IModelPlugin } from "../../core/interfaces.js";

export interface OpenAIModelOptions {
  /** Model identifier (default: "gpt-4o") */
  model?: string;
  /** API key (falls back to OPENAI_API_KEY env var) */
  apiKey?: string;
  /** Custom base URL */
  baseURL?: string;
}

/**
 * OpenAI LLM model plugin.
 * Uses @ai-sdk/openai under the hood (dynamic import — install as peer dep).
 *
 * @example
 * ```ts
 * import { OpenAIModel } from "agent-eval";
 * const model = new OpenAIModel({ model: "gpt-4o" });
 * ```
 */
export class OpenAIModel implements IModelPlugin {
  readonly name = "openai";
  readonly modelId: string;
  private apiKey?: string;
  private baseURL?: string;

  constructor(options: OpenAIModelOptions = {}) {
    this.modelId = options.model ?? "gpt-4o";
    this.apiKey = options.apiKey;
    this.baseURL = options.baseURL;
  }

  async createModel() {
    const { createOpenAI } = await import("@ai-sdk/openai");
    const provider = createOpenAI({
      apiKey: this.apiKey ?? process.env.OPENAI_API_KEY,
      ...(this.baseURL ? { baseURL: this.baseURL } : {}),
    });
    return provider(this.modelId);
  }
}
