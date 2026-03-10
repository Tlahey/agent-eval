import type { IModelPlugin, ModelSettings } from "../../core/interfaces.js";
import { env } from "../../core/env.js";

export interface OpenAIModelOptions {
  /** Model identifier (default: "gpt-4o") */
  model?: string;
  /** API key (falls back to OPENAI_API_KEY env var) */
  apiKey?: string;
  /** Custom base URL */
  baseURL?: string;
  /** Generation settings */
  settings?: ModelSettings;
  /** AI SDK tools for agentic execution */
  tools?: Record<string, unknown>;
}

/**
 * OpenAI LLM model plugin.
 * Uses @ai-sdk/openai under the hood (dynamic import — install as peer dep).
 *
 * @example
 * ```ts
 * import { OpenAIModel } from "agent-eval/llm";
 * const model = new OpenAIModel({ model: "gpt-4o" });
 * ```
 */
export class OpenAIModel implements IModelPlugin {
  readonly name = "openai";
  readonly modelId: string;
  readonly settings?: ModelSettings;
  readonly tools?: Record<string, unknown>;
  private apiKey?: string;
  private baseURL?: string;

  constructor(options: OpenAIModelOptions = {}) {
    this.modelId = options.model ?? "gpt-4o";
    this.apiKey = options.apiKey;
    this.baseURL = options.baseURL;
    this.settings = options.settings;
    this.tools = options.tools;
  }

  async createModel(): Promise<unknown> {
    const { createOpenAI } = await import("@ai-sdk/openai");
    const provider = createOpenAI({
      apiKey: this.apiKey ?? env.openaiApiKey,
      ...(this.baseURL ? { baseURL: this.baseURL } : {}),
    });
    return provider(this.modelId);
  }
}
