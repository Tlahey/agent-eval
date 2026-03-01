import type { IModelPlugin } from "../../core/interfaces.js";

export interface AnthropicModelOptions {
  /** Model identifier (default: "claude-sonnet-4-20250514") */
  model?: string;
  /** API key (falls back to ANTHROPIC_API_KEY env var) */
  apiKey?: string;
  /** Custom base URL */
  baseURL?: string;
}

/**
 * Anthropic LLM model plugin.
 * Uses @ai-sdk/anthropic under the hood (dynamic import — install as peer dep).
 *
 * @example
 * ```ts
 * import { AnthropicModel } from "agent-eval";
 * const model = new AnthropicModel({ model: "claude-sonnet-4-20250514" });
 * ```
 */
export class AnthropicModel implements IModelPlugin {
  readonly name = "anthropic";
  readonly modelId: string;
  private apiKey?: string;
  private baseURL?: string;

  constructor(options: AnthropicModelOptions = {}) {
    this.modelId = options.model ?? "claude-sonnet-4-20250514";
    this.apiKey = options.apiKey;
    this.baseURL = options.baseURL;
  }

  async createModel() {
    const { createAnthropic } = await import("@ai-sdk/anthropic");
    const provider = createAnthropic({
      apiKey: this.apiKey ?? process.env.ANTHROPIC_API_KEY,
      ...(this.baseURL ? { baseURL: this.baseURL } : {}),
    });
    return provider(this.modelId);
  }
}
