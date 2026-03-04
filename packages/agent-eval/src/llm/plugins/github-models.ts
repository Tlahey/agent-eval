import type { IModelPlugin, ModelSettings } from "../../core/interfaces.js";

export interface GitHubModelsOptions {
  /**
   * Model identifier (e.g., "openai/gpt-5-mini", "openai/gpt-4o", "meta/llama-4-scout").
   * Uses the GitHub Models catalog naming convention.
   * @default "openai/gpt-4o"
   */
  model?: string;
  /**
   * GitHub token for authentication.
   * Falls back to GH_COPILOT_TOKEN → GITHUB_TOKEN env vars.
   *
   * To get a token from Copilot CLI: `gh auth token`
   */
  token?: string;
  /**
   * Custom base URL for the inference endpoint.
   * @default "https://models.github.ai/inference"
   */
  baseURL?: string;
  /**
   * Generation settings forwarded to `generateObject()` / `generateText()`.
   * These are applied at call time (temperature, maxTokens, topP).
   *
   * @example
   * ```ts
   * new GitHubModelsModel({
   *   model: "openai/gpt-5-mini",
   *   settings: { temperature: 1, maxTokens: 4096, topP: 1 },
   * })
   * ```
   */
  settings?: ModelSettings;
}

/**
 * GitHub Models LLM plugin — uses the GitHub Models inference API.
 *
 * OpenAI-compatible endpoint powered by GitHub Copilot / GitHub Models.
 * Supports structured JSON output via `response_format: { type: "json_object" }`.
 * Authentication via GitHub token (GH_COPILOT_TOKEN or GITHUB_TOKEN).
 *
 * @example
 * ```ts
 * import { GitHubModelsModel } from "agent-eval/llm";
 *
 * // Use as judge (recommended — supports JSON structured output)
 * defineConfig({
 *   judge: {
 *     name: "gpt-5-mini",
 *     model: new GitHubModelsModel({ model: "openai/gpt-5-mini" }),
 *   },
 *   // ...
 * });
 *
 * // Use with generation settings
 * defineConfig({
 *   runners: [
 *     {
 *       name: "gpt-5-mini",
 *       model: new GitHubModelsModel({
 *         model: "openai/gpt-5-mini",
 *         settings: { temperature: 1, maxTokens: 4096, topP: 1 },
 *       }),
 *     },
 *   ],
 *   // ...
 * });
 * ```
 */
export class GitHubModelsModel implements IModelPlugin {
  readonly name = "github-models";
  readonly modelId: string;
  readonly settings?: ModelSettings;
  private token?: string;
  private baseURL: string;

  constructor(options: GitHubModelsOptions = {}) {
    this.modelId = options.model ?? "openai/gpt-4o";
    this.token = options.token;
    this.baseURL = options.baseURL ?? "https://models.github.ai/inference";
    this.settings = options.settings;
  }

  private resolveToken(): string {
    const token = this.token ?? process.env.GH_COPILOT_TOKEN ?? process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error(
        "GitHub Models requires a token. Set GH_COPILOT_TOKEN or GITHUB_TOKEN env var, " +
          "or pass `token` in the constructor.\n" +
          "Get a token with: gh auth token",
      );
    }
    return token;
  }

  async createModel(): Promise<unknown> {
    const { createOpenAI } = await import("@ai-sdk/openai");
    const provider = createOpenAI({
      baseURL: this.baseURL,
      apiKey: this.resolveToken(),
    });
    // Enable structuredOutputs for guaranteed JSON responses
    return provider(this.modelId, { structuredOutputs: true });
  }
}
