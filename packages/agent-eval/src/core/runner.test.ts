import { describe, it, expect, vi, beforeEach } from "vitest";
import { setLastJudgeResult, getLastJudgeResult, clearLastJudgeResult, runTest } from "./runner.js";
import type { AgentEvalConfig, TestDefinition, JudgeResult } from "./types.js";

// Mock external deps
vi.mock("../git/git.js", () => ({
  gitResetHard: vi.fn(),
  gitDiff: vi.fn(() => "mock diff content"),
}));

vi.mock("../ledger/ledger.js", () => ({
  appendLedgerEntry: vi.fn(),
}));

vi.mock("chalk", () => ({
  default: {
    blue: (s: string) => s,
    gray: (s: string) => s,
    dim: (s: string) => s,
    green: (s: string) => s,
    red: (s: string) => s,
    yellow: (s: string) => s,
  },
}));

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

vi.mock("node:fs", () => ({
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));

vi.mock("@ai-sdk/anthropic", () => ({
  createAnthropic: vi.fn(() => (model: string) => ({ modelId: model, provider: "anthropic" })),
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(() => (model: string) => ({ modelId: model, provider: "openai" })),
}));

import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

describe("runner - judge result store", () => {
  beforeEach(() => {
    clearLastJudgeResult();
  });

  it("starts with null", () => {
    expect(getLastJudgeResult()).toBeNull();
  });

  it("stores and retrieves a judge result", () => {
    const result: JudgeResult = { pass: true, score: 0.9, reason: "good" };
    setLastJudgeResult(result);
    expect(getLastJudgeResult()).toEqual(result);
  });

  it("clears the stored result", () => {
    setLastJudgeResult({ pass: false, score: 0.3, reason: "bad" });
    clearLastJudgeResult();
    expect(getLastJudgeResult()).toBeNull();
  });
});

describe("runner - runTest", () => {
  const baseConfig: AgentEvalConfig = {
    rootDir: "/tmp/test",
    outputDir: "/tmp/test/.agenteval",
    runners: [{ name: "mock-cli", type: "cli", command: "echo {{prompt}}" }],
    judge: { provider: "openai", model: "gpt-4o" },
    timeout: 5000,
  };

  beforeEach(() => {
    clearLastJudgeResult();
    vi.clearAllMocks();
  });

  it("returns results for each runner", async () => {
    const testDef: TestDefinition = {
      title: "test-basic",
      fn: vi.fn().mockResolvedValue(undefined),
    };

    const results = await runTest(testDef, baseConfig);
    expect(results).toHaveLength(1);
    expect(results[0].testId).toBe("test-basic");
    expect(results[0].runner).toBe("mock-cli");
  });

  it("captures judge results from the global store", async () => {
    const testDef: TestDefinition = {
      title: "test-judge",
      fn: vi.fn().mockImplementation(() => {
        setLastJudgeResult({ pass: true, score: 0.95, reason: "excellent" });
      }),
    };

    const results = await runTest(testDef, baseConfig);
    expect(results[0].passed).toBe(true);
    expect(results[0].entries[0].score).toBe(0.95);
    expect(results[0].entries[0].reason).toBe("excellent");
  });

  it("handles test function errors gracefully", async () => {
    const testDef: TestDefinition = {
      title: "test-error",
      fn: vi.fn().mockRejectedValue(new Error("boom")),
    };

    const results = await runTest(testDef, baseConfig);
    expect(results[0].passed).toBe(false);
    expect(results[0].entries[0].reason).toContain("boom");
    expect(results[0].entries[0].score).toBe(0);
  });

  it("filters runners when matrix is configured", async () => {
    const config: AgentEvalConfig = {
      ...baseConfig,
      runners: [
        { name: "runner-a", type: "cli", command: "echo a" },
        { name: "runner-b", type: "cli", command: "echo b" },
      ],
      matrix: { runners: ["runner-b"] },
    };

    const testDef: TestDefinition = {
      title: "test-matrix",
      fn: vi.fn().mockResolvedValue(undefined),
    };

    const results = await runTest(testDef, config);
    expect(results).toHaveLength(1);
    expect(results[0].runner).toBe("runner-b");
  });

  it("records entry with no judge when test completes silently", async () => {
    const testDef: TestDefinition = {
      title: "test-no-judge",
      fn: vi.fn().mockResolvedValue(undefined),
    };

    const results = await runTest(testDef, baseConfig);
    expect(results[0].entries[0].pass).toBe(false);
    expect(results[0].entries[0].reason).toBe("Test completed without judge evaluation");
  });
});

describe("runner - createAgent via runTest", () => {
  beforeEach(() => {
    clearLastJudgeResult();
    vi.clearAllMocks();
  });

  it("CLI runner calls execSync with the command", async () => {
    const config: AgentEvalConfig = {
      rootDir: "/tmp/test",
      outputDir: "/tmp/test/.agenteval",
      runners: [{ name: "cli-runner", type: "cli", command: "echo {{prompt}}" }],
      judge: { provider: "openai", model: "gpt-4o" },
    };

    const testDef: TestDefinition = {
      title: "test-cli-exec",
      fn: vi.fn().mockImplementation(async ({ agent }) => {
        await agent.run("hello world");
      }),
    };

    await runTest(testDef, config);

    expect(execSync).toHaveBeenCalledWith(
      "echo hello world",
      expect.objectContaining({
        cwd: "/tmp/test",
        stdio: "inherit",
      }),
    );
  });

  it("CLI runner throws error when command is missing", async () => {
    const config: AgentEvalConfig = {
      rootDir: "/tmp/test",
      outputDir: "/tmp/test/.agenteval",
      runners: [{ name: "no-cmd", type: "cli" }],
      judge: { provider: "openai", model: "gpt-4o" },
    };

    const testDef: TestDefinition = {
      title: "test-no-cmd",
      fn: vi.fn().mockImplementation(async ({ agent }) => {
        await agent.run("prompt");
      }),
    };

    const results = await runTest(testDef, config);
    expect(results[0].passed).toBe(false);
    expect(results[0].entries[0].reason).toContain("no command defined");
  });

  it("API runner calls generateObject and writes files", async () => {
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        files: [{ path: "src/test.ts", content: "const x = 1;" }],
      },
    } as never);

    const config: AgentEvalConfig = {
      rootDir: "/tmp/test",
      outputDir: "/tmp/test/.agenteval",
      runners: [
        {
          name: "api-runner",
          type: "api",
          api: { provider: "anthropic", model: "claude-sonnet-4-20250514" },
        },
      ],
      judge: { provider: "openai", model: "gpt-4o" },
    };

    const testDef: TestDefinition = {
      title: "test-api-runner",
      fn: vi.fn().mockImplementation(async ({ agent }) => {
        await agent.run("create a file");
      }),
    };

    await runTest(testDef, config);

    expect(generateObject).toHaveBeenCalledOnce();
    expect(mkdirSync).toHaveBeenCalled();
    expect(writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining("src/test.ts"),
      "const x = 1;",
      "utf-8",
    );
  });

  it("API runner throws when api config is missing", async () => {
    const config: AgentEvalConfig = {
      rootDir: "/tmp/test",
      outputDir: "/tmp/test/.agenteval",
      runners: [{ name: "no-api", type: "api" }],
      judge: { provider: "openai", model: "gpt-4o" },
    };

    const testDef: TestDefinition = {
      title: "test-no-api",
      fn: vi.fn().mockImplementation(async ({ agent }) => {
        await agent.run("prompt");
      }),
    };

    const results = await runTest(testDef, config);
    expect(results[0].passed).toBe(false);
    expect(results[0].entries[0].reason).toContain("no api config defined");
  });

  it("resolves openai provider for API runner", async () => {
    vi.mocked(generateObject).mockResolvedValue({
      object: { files: [] },
    } as never);

    const config: AgentEvalConfig = {
      rootDir: "/tmp/test",
      outputDir: "/tmp/test/.agenteval",
      runners: [
        {
          name: "openai-runner",
          type: "api",
          api: { provider: "openai", model: "gpt-4o" },
        },
      ],
      judge: { provider: "openai", model: "gpt-4o" },
    };

    const testDef: TestDefinition = {
      title: "test-openai",
      fn: vi.fn().mockImplementation(async ({ agent }) => {
        await agent.run("task");
      }),
    };

    await runTest(testDef, config);
    expect(createOpenAI).toHaveBeenCalled();
  });

  it("resolves ollama provider for API runner", async () => {
    vi.mocked(generateObject).mockResolvedValue({
      object: { files: [] },
    } as never);

    const config: AgentEvalConfig = {
      rootDir: "/tmp/test",
      outputDir: "/tmp/test/.agenteval",
      runners: [
        {
          name: "ollama-runner",
          type: "api",
          api: { provider: "ollama", model: "llama3" },
        },
      ],
      judge: { provider: "openai", model: "gpt-4o" },
    };

    const testDef: TestDefinition = {
      title: "test-ollama",
      fn: vi.fn().mockImplementation(async ({ agent }) => {
        await agent.run("task");
      }),
    };

    await runTest(testDef, config);
    expect(createOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: "http://localhost:11434/v1",
        apiKey: "ollama",
      }),
    );
  });

  it("throws for unknown runner type", async () => {
    const config: AgentEvalConfig = {
      rootDir: "/tmp/test",
      outputDir: "/tmp/test/.agenteval",
      runners: [{ name: "bad", type: "unknown" as never }],
      judge: { provider: "openai", model: "gpt-4o" },
    };

    const testDef: TestDefinition = {
      title: "test-unknown-type",
      fn: vi.fn().mockImplementation(async ({ agent }) => {
        await agent.run("task");
      }),
    };

    const results = await runTest(testDef, config);
    expect(results[0].passed).toBe(false);
    expect(results[0].entries[0].reason).toContain("Unknown runner type");
  });

  it("throws for unsupported API provider", async () => {
    const config: AgentEvalConfig = {
      rootDir: "/tmp/test",
      outputDir: "/tmp/test/.agenteval",
      runners: [
        {
          name: "bad-provider",
          type: "api",
          api: { provider: "unsupported" as never, model: "test" },
        },
      ],
      judge: { provider: "openai", model: "gpt-4o" },
    };

    const testDef: TestDefinition = {
      title: "test-bad-provider",
      fn: vi.fn().mockImplementation(async ({ agent }) => {
        await agent.run("task");
      }),
    };

    const results = await runTest(testDef, config);
    expect(results[0].passed).toBe(false);
    expect(results[0].entries[0].reason).toContain("Unsupported API runner provider");
  });
});

describe("runner - auto storeDiff and afterEach", () => {
  beforeEach(() => {
    clearLastJudgeResult();
    vi.clearAllMocks();
  });

  it("auto-calls storeDiff after agent.run()", async () => {
    const config: AgentEvalConfig = {
      rootDir: "/tmp/test",
      outputDir: "/tmp/test/.agenteval",
      runners: [{ name: "cli", type: "cli", command: "echo {{prompt}}" }],
      judge: { provider: "openai", model: "gpt-4o" },
    };

    const testDef: TestDefinition = {
      title: "test-auto-diff",
      fn: vi.fn().mockImplementation(async ({ agent, ctx }) => {
        expect(ctx.diff).toBeNull();
        await agent.run("task");
        // storeDiff should have been called automatically
        expect(ctx.diff).toBe("mock diff content");
      }),
    };

    const results = await runTest(testDef, config);
    expect(results[0].entries[0].context.diff).toBe("mock diff content");
  });

  it("runs afterEach commands from config after agent.run()", async () => {
    const config: AgentEvalConfig = {
      rootDir: "/tmp/test",
      outputDir: "/tmp/test/.agenteval",
      runners: [{ name: "cli", type: "cli", command: "echo {{prompt}}" }],
      judge: { provider: "openai", model: "gpt-4o" },
      afterEach: [
        { name: "test", command: "pnpm test" },
        { name: "build", command: "pnpm build" },
      ],
    };

    const testDef: TestDefinition = {
      title: "test-after-each",
      fn: vi.fn().mockImplementation(async ({ agent, ctx }) => {
        await agent.run("task");
        // afterEach commands should have run
        expect(ctx.commands).toHaveLength(2);
        expect(ctx.commands[0].name).toBe("test");
        expect(ctx.commands[1].name).toBe("build");
      }),
    };

    await runTest(testDef, config);
  });

  it("does not run afterEach commands when not configured", async () => {
    const config: AgentEvalConfig = {
      rootDir: "/tmp/test",
      outputDir: "/tmp/test/.agenteval",
      runners: [{ name: "cli", type: "cli", command: "echo {{prompt}}" }],
      judge: { provider: "openai", model: "gpt-4o" },
    };

    const testDef: TestDefinition = {
      title: "test-no-after-each",
      fn: vi.fn().mockImplementation(async ({ agent, ctx }) => {
        await agent.run("task");
        expect(ctx.commands).toHaveLength(0);
      }),
    };

    const results = await runTest(testDef, config);
    expect(results[0].passed).toBe(false); // no judge = fail
  });

  it("still allows manual storeDiff and runCommand alongside auto", async () => {
    const config: AgentEvalConfig = {
      rootDir: "/tmp/test",
      outputDir: "/tmp/test/.agenteval",
      runners: [{ name: "cli", type: "cli", command: "echo {{prompt}}" }],
      judge: { provider: "openai", model: "gpt-4o" },
      afterEach: [{ name: "build", command: "pnpm build" }],
    };

    const testDef: TestDefinition = {
      title: "test-manual-plus-auto",
      fn: vi.fn().mockImplementation(async ({ agent, ctx }) => {
        await agent.run("task");
        // Auto: storeDiff + build already ran
        // Manual additional command
        await ctx.runCommand("lint", "pnpm lint");
        expect(ctx.commands).toHaveLength(2); // build (auto) + lint (manual)
        expect(ctx.commands[0].name).toBe("build");
        expect(ctx.commands[1].name).toBe("lint");
      }),
    };

    await runTest(testDef, config);
  });
});
