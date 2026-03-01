/**
 * Base LLM Plugin — shared logic for Vercel AI SDK-based providers.
 *
 * Subclasses only need to implement `createModel()` to return the
 * AI SDK model instance for their specific provider.
 */

import { generateObject } from "ai";
import { z } from "zod";
import type { JudgeResult } from "../core/types.js";
import type {
  ILLMPlugin,
  LLMEvaluationOptions,
  LLMGenerationOptions,
  AgentFileOutput,
} from "../core/interfaces.js";

const JudgeResultSchema = z.object({
  pass: z.boolean().describe("Whether the agent output meets the criteria"),
  score: z.number().min(0).max(1).describe("Score from 0.0 (total failure) to 1.0 (perfect)"),
  reason: z.string().describe("Markdown-formatted explanation of the evaluation"),
  improvement: z
    .string()
    .describe("Markdown-formatted actionable suggestions to improve the score"),
});

const FileOperationSchema = z.object({
  files: z
    .array(
      z.object({
        path: z.string().describe("Relative file path from project root"),
        content: z.string().describe("Full file content to write"),
      }),
    )
    .describe("Files to create or modify"),
});

export interface BaseLLMOptions {
  /** Default model name to use */
  defaultModel: string;
  /** Optional API key (falls back to env var) */
  apiKey?: string;
  /** Optional base URL override */
  baseURL?: string;
}

export abstract class BaseLLMPlugin implements ILLMPlugin {
  abstract readonly name: string;
  abstract readonly provider: string;
  readonly defaultModel: string;
  protected apiKey?: string;
  protected baseURL?: string;

  constructor(options: BaseLLMOptions) {
    this.defaultModel = options.defaultModel;
    this.apiKey = options.apiKey;
    this.baseURL = options.baseURL;
  }

  /** Create the AI SDK model instance. Implemented by each provider subclass. */
  protected abstract createModel(modelName: string): Promise<ReturnType<typeof Object>>;

  async evaluate(options: LLMEvaluationOptions): Promise<JudgeResult> {
    const modelName = options.model ?? this.defaultModel;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model = (await this.createModel(modelName)) as any;

    const { object } = await generateObject({
      model,
      schema: JudgeResultSchema,
      prompt: options.prompt,
    });

    return object;
  }

  async generate(options: LLMGenerationOptions): Promise<AgentFileOutput> {
    const modelName = options.model ?? this.defaultModel;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model = (await this.createModel(modelName)) as any;

    const { object } = await generateObject({
      model,
      schema: FileOperationSchema,
      prompt: `You are an expert coding agent. You must complete the following task by modifying or creating files in a project.

Task: ${options.prompt}

Respond with the list of files to create or modify. Each file must include the full content (not a diff). Only include files that need changes.`,
    });

    return object as AgentFileOutput;
  }
}
