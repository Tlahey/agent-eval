import type { IModelPlugin } from "../../core/interfaces.js";

export interface OllamaModelOptions {
  /** Model identifier (default: "llama3") */
  model?: string;
  /** Custom base URL (default: "http://localhost:11434/v1") */
  baseURL?: string;
}

/**
 * Ollama LLM model plugin.
 * Uses @ai-sdk/openai with Ollama's OpenAI-compatible endpoint.
 *
 * @example
 * ```ts
 * import { OllamaModel } from "agent-eval";
 * const model = new OllamaModel({ model: "llama3" });
 * ```
 */
export class OllamaModel implements IModelPlugin {
  readonly name = "ollama";
  readonly modelId: string;
  private baseURL: string;

  constructor(options: OllamaModelOptions = {}) {
    this.modelId = options.model ?? "llama3";
    this.baseURL = options.baseURL ?? "http://localhost:11434/v1";
  }

  async createModel() {
    const { createOpenAI } = await import("@ai-sdk/openai");
    const provider = createOpenAI({
      baseURL: this.baseURL,
      apiKey: "ollama",
    });
    return provider(this.modelId);
  }
}
