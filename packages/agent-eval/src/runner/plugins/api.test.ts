import { describe, it, expect, vi, beforeEach } from "vitest";
import { APIRunner } from "./api.js";
import type { IModelPlugin, IEnvironmentPlugin, RunnerContext } from "../../core/interfaces.js";

vi.mock("ai", () => ({
  generateObject: vi.fn().mockResolvedValue({
    object: {
      files: [
        { path: "src/hello.ts", content: 'export const hello = "world";' },
        { path: "src/index.ts", content: 'export { hello } from "./hello.js";' },
      ],
    },
  }),
}));

vi.mock("node:fs", () => ({
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

import { generateObject } from "ai";
import { writeFileSync, mkdirSync } from "node:fs";

function createMockModel(modelId = "test-model"): IModelPlugin {
  return {
    name: "mock-provider",
    modelId,
    createModel: vi.fn(() => ({ modelId, provider: "mock" })),
  };
}

function createMockEnv(): IEnvironmentPlugin {
  return {
    name: "mock",
    setup: vi.fn(),
    execute: vi.fn(() => ({ stdout: "", stderr: "", exitCode: 0 })),
    getDiff: vi.fn(() => ""),
  };
}

function createContext(): RunnerContext {
  return { cwd: "/tmp/project", env: createMockEnv(), timeout: 30_000 };
}

describe("APIRunner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has name and model from options", () => {
    const model = createMockModel("claude-sonnet-4-20250514");
    const runner = new APIRunner({ name: "claude", model });
    expect(runner.name).toBe("claude");
    expect(runner.model).toBe("claude-sonnet-4-20250514");
  });

  it("calls createModel and generateObject with the prompt", async () => {
    const model = createMockModel("gpt-4o");
    const runner = new APIRunner({ name: "gpt", model });

    await runner.execute("create a hello world", createContext());

    expect(model.createModel).toHaveBeenCalledOnce();
    expect(generateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("create a hello world"),
      }),
    );
  });

  it("writes generated files to disk", async () => {
    const model = createMockModel();
    const runner = new APIRunner({ name: "test", model });

    const result = await runner.execute("task", createContext());

    expect(mkdirSync).toHaveBeenCalledTimes(2);
    expect(writeFileSync).toHaveBeenCalledTimes(2);
    expect(writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining("src/hello.ts"),
      'export const hello = "world";',
      "utf-8",
    );
    expect(result.filesWritten).toEqual(["src/hello.ts", "src/index.ts"]);
  });

  it("returns empty filesWritten when no files generated", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: { files: [] },
    } as never);

    const model = createMockModel();
    const runner = new APIRunner({ name: "test", model });

    const result = await runner.execute("task", createContext());
    expect(result.filesWritten).toEqual([]);
    expect(writeFileSync).not.toHaveBeenCalled();
  });
});
