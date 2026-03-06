import type { IModelPlugin, ModelSettings } from "../../core/interfaces.js";
import { env } from "../../core/env.js";
import { debug, isDebug, maskToken } from "../../core/debug.js";

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
   * These are applied at call time (temperature, maxTokens, topP, maxSteps).
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
  /**
   * AI SDK tools the model can call during execution.
   * When provided, the runner uses `generateText()` with multi-step tool calling
   * instead of `generateObject()`. Define any tools your agent needs — the framework
   * passes them directly to the AI SDK. File changes are captured by git diff.
   *
   * @see https://ai-sdk.dev/docs/foundations/tools
   *
   * @example
   * ```ts
   * import { tool } from "ai";
   * import { z } from "zod";
   * import { readFileSync, writeFileSync } from "fs";
   *
   * new GitHubModelsModel({
   *   model: "openai/gpt-5-mini",
   *   tools: {
   *     readFile: tool({
   *       description: "Read a file from the project",
   *       parameters: z.object({ path: z.string() }),
   *       execute: async ({ path }) => readFileSync(path, "utf-8"),
   *     }),
   *     writeFile: tool({
   *       description: "Write content to a file",
   *       parameters: z.object({ path: z.string(), content: z.string() }),
   *       execute: async ({ path, content }) => { writeFileSync(path, content); return "ok"; },
   *     }),
   *   },
   * })
   * ```
   */
  tools?: Record<string, unknown>;
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
 * // Use with tools (agentic mode)
 * import { tool } from "ai";
 * import { z } from "zod";
 *
 * defineConfig({
 *   runners: [
 *     {
 *       name: "gpt-5-mini-agent",
 *       model: new GitHubModelsModel({
 *         model: "openai/gpt-5-mini",
 *         settings: { temperature: 1, maxTokens: 4096, maxSteps: 15 },
 *         tools: {
 *           readFile: tool({
 *             description: "Read a file",
 *             parameters: z.object({ path: z.string() }),
 *             execute: async ({ path }) => require("fs").readFileSync(path, "utf-8"),
 *           }),
 *         },
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
  readonly tools?: Record<string, unknown>;
  private token?: string;
  private baseURL: string;

  constructor(options: GitHubModelsOptions = {}) {
    this.modelId = options.model ?? "openai/gpt-4o";
    this.token = options.token;
    this.baseURL = options.baseURL ?? "https://models.github.ai/inference";
    this.settings = options.settings;
    this.tools = options.tools;
  }

  private resolveToken(): string {
    const token = this.token ?? env.ghCopilotToken;
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

    const token = this.resolveToken();

    if (isDebug()) {
      debug(`[github-models] Initializing with baseURL: ${this.baseURL}`);
      debug(`[github-models] Token: ${maskToken(token)}`);
    }

    const provider = createOpenAI({
      baseURL: this.baseURL,
      apiKey: token,
      fetch: async (url, options) => {
        if (isDebug()) {
          debug(`[github-models] fetch: ${options?.method ?? "GET"} ${url}`);
          // Log headers but mask Authorization
          const headers = (options?.headers as Record<string, string>) || {};
          const safeHeaders = { ...headers };
          if (safeHeaders["Authorization"]) {
            const val = safeHeaders["Authorization"];
            safeHeaders["Authorization"] = val.startsWith("Bearer ")
              ? `Bearer ${maskToken(val.substring(7))}`
              : maskToken(val);
          }
          debug(`[github-models] headers:`, JSON.stringify(safeHeaders));
        }

        try {
          const response = await fetch(url, options);
          if (isDebug()) {
            debug(`[github-models] response: ${response.status} ${response.statusText}`);
          }
          return response;
        } catch (err: unknown) {
          if (isDebug()) {
            const message = err instanceof Error ? err.message : String(err);
            debug(`[github-models] fetch ERROR:`, message);
            if (message.includes("local issuer certificate")) {
              debug(
                `[github-models] TIP: This SSL error often occurs behind a corporate proxy. ` +
                  `Try setting NODE_TLS_REJECT_UNAUTHORIZED=0 (insecure) or NODE_EXTRA_CA_CERTS.`,
              );
            }
          }
          throw err;
        }
      },
    });

    // Enable structuredOutputs for guaranteed JSON responses
    return provider(this.modelId, { structuredOutputs: true });
  }
}
