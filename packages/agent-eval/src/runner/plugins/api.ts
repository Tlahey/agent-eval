import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type {
  IRunnerPlugin,
  IModelPlugin,
  RunnerContext,
  RunnerExecResult,
} from "../../core/interfaces.js";

export interface APIRunnerOptions {
  /** Unique name for the runner (e.g., "claude", "gpt-4o") */
  name: string;
  /** LLM model plugin to use for generation */
  model: IModelPlugin;
}

/**
 * API-based agent runner.
 * Calls an LLM via the Vercel AI SDK `generateObject()` to generate file operations,
 * then writes the files to disk. The model is provided by an IModelPlugin.
 *
 * @example
 * ```ts
 * import { APIRunner, AnthropicModel } from "agent-eval";
 * const runner = new APIRunner({
 *   name: "claude",
 *   model: new AnthropicModel({ model: "claude-sonnet-4-20250514" }),
 * });
 * ```
 */
export class APIRunner implements IRunnerPlugin {
  readonly name: string;
  readonly model: string;
  private modelPlugin: IModelPlugin;

  constructor(options: APIRunnerOptions) {
    this.name = options.name;
    this.modelPlugin = options.model;
    this.model = options.model.modelId;
  }

  async execute(prompt: string, context: RunnerContext): Promise<RunnerExecResult> {
    const { generateObject } = await import("ai");
    const { z } = await import("zod");

    const model = await this.modelPlugin.createModel();

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

    const { object } = await generateObject({
      model: model as Parameters<typeof generateObject>[0]["model"],
      schema: FileOperationSchema,
      prompt: `You are an expert coding agent. You must complete the following task by modifying or creating files in a project.

Task: ${prompt}

Respond with the list of files to create or modify. Each file must include the full content (not a diff). Only include files that need changes.`,
    });

    const response = object as { files: Array<{ path: string; content: string }> };
    const filesWritten: string[] = [];

    for (const file of response.files) {
      const fullPath = resolve(context.cwd, file.path);
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, file.content, "utf-8");
      filesWritten.push(file.path);
    }

    return { filesWritten };
  }
}
