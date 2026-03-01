import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  setLastJudgeResult,
  getLastJudgeResult,
  clearLastJudgeResult,
  runTest,
  dryRunTest,
} from "./runner.js";
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

// Mock LocalEnvironment so runner uses a mock env instead of real git/execSync
const mockEnvInstance = {
  name: "local",
  setup: vi.fn(),
  execute: vi.fn(() => ({ stdout: "", stderr: "", exitCode: 0 })),
  getDiff: vi.fn(() => "mock diff content"),
};
vi.mock("../environment/local-environment.js", () => ({
  LocalEnvironment: vi.fn(() => mockEnvInstance),
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

// Mock the judge module for declarative pipeline tests
vi.mock("../judge/judge.js", () => ({
  judge: vi.fn(() => ({ pass: true, score: 0.85, reason: "good", improvement: "none" })),
  buildDeclarativeJudgePrompt: vi.fn(() => "mock declarative criteria"),
}));

// Mock the index module for hook registration
vi.mock("../index.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../index.js")>();
  return {
    ...original,
    getRegisteredBeforeEachHooks: vi.fn(() => []),
    getRegisteredAfterEachHooks: vi.fn(() => []),
    getMatchingHooks: vi.fn(() => []),
  };
});

import { writeFileSync, mkdirSync } from "node:fs";
import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { judge as runJudge } from "../judge/judge.js";
import { getMatchingHooks } from "../index.js";

describe("runner - judge result store", () => {
  beforeEach(() => {
    clearLastJudgeResult();
  });

  it("starts with null", () => {
    expect(getLastJudgeResult()).toBeNull();
  });

  it("stores and retrieves a judge result", () => {
    const result: JudgeResult = { pass: true, score: 0.9, reason: "good", improvement: "none" };
    setLastJudgeResult(result);
    expect(getLastJudgeResult()).toEqual(result);
  });

  it("clears the stored result", () => {
    setLastJudgeResult({ pass: false, score: 0.3, reason: "bad", improvement: "fix it" });
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
    mockEnvInstance.execute.mockReturnValue({ stdout: "", stderr: "", exitCode: 0 });
    mockEnvInstance.getDiff.mockReturnValue("mock diff content");
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
        setLastJudgeResult({ pass: true, score: 0.95, reason: "excellent", improvement: "none" });
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

  it("fails with explicit error when test completes without judge evaluation", async () => {
    const testDef: TestDefinition = {
      title: "test-no-judge",
      fn: vi.fn().mockResolvedValue(undefined),
    };

    const results = await runTest(testDef, baseConfig);
    expect(results[0].passed).toBe(false);
    expect(results[0].entries[0].reason).toContain("completed without a judge evaluation");
    expect(results[0].entries[0].reason).toContain("toPassJudge");
  });
});

describe("runner - createAgent via runTest", () => {
  beforeEach(() => {
    clearLastJudgeResult();
    vi.clearAllMocks();
    mockEnvInstance.execute.mockReturnValue({ stdout: "", stderr: "", exitCode: 0 });
    mockEnvInstance.getDiff.mockReturnValue("mock diff content");
  });

  it("CLI runner calls env.execute with the command", async () => {
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

    expect(mockEnvInstance.execute).toHaveBeenCalledWith(
      "echo hello world",
      "/tmp/test",
      expect.objectContaining({ timeout: 600_000 }),
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
    mockEnvInstance.execute.mockReturnValue({ stdout: "", stderr: "", exitCode: 0 });
    mockEnvInstance.getDiff.mockReturnValue("mock diff content");
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
    expect(results[0].passed).toBe(false); // no judge = error
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

describe("runner - declarative pipeline (agent.instruct)", () => {
  const baseConfig: AgentEvalConfig = {
    rootDir: "/tmp/test",
    outputDir: "/tmp/test/.agenteval",
    runners: [{ name: "mock-cli", type: "cli", command: "echo {{prompt}}" }],
    judge: { provider: "openai", model: "gpt-4o" },
  };

  beforeEach(() => {
    clearLastJudgeResult();
    vi.clearAllMocks();
    mockEnvInstance.execute.mockReturnValue({ stdout: "", stderr: "", exitCode: 0 });
    mockEnvInstance.getDiff.mockReturnValue("mock diff content");
  });

  it("executes declarative pipeline when agent.instruct() is used", async () => {
    const testDef: TestDefinition = {
      title: "test-declarative",
      fn: ({ agent, ctx }) => {
        agent.instruct("Add a close button to the Banner");
        ctx.addTask({
          name: "Build",
          action: () =>
            Promise.resolve({
              name: "Build",
              command: "pnpm build",
              stdout: "ok",
              stderr: "",
              exitCode: 0,
              durationMs: 100,
            }),
          criteria: "build must succeed",
          weight: 2,
        });
      },
    };

    const results = await runTest(testDef, baseConfig);
    expect(results).toHaveLength(1);
    // Agent should have been executed via the raw agent
    expect(mockEnvInstance.execute).toHaveBeenCalled();
    // Judge should have been called for declarative pipeline
    expect(runJudge).toHaveBeenCalled();
  });

  it("enforces single-instruct policy", async () => {
    const testDef: TestDefinition = {
      title: "test-single-instruct",
      fn: ({ agent }) => {
        agent.instruct("First instruction");
        agent.instruct("Second instruction"); // should throw
      },
    };

    const results = await runTest(testDef, baseConfig);
    expect(results[0].passed).toBe(false);
    expect(results[0].entries[0].reason).toContain("Single-Instruct Policy");
  });

  it("prevents mixing instruct() and run()", async () => {
    const testDef: TestDefinition = {
      title: "test-mixed-instruct-run",
      fn: async ({ agent }) => {
        agent.instruct("instruction");
        await agent.run("prompt"); // should throw
      },
    };

    const results = await runTest(testDef, baseConfig);
    expect(results[0].passed).toBe(false);
    expect(results[0].entries[0].reason).toContain("Cannot use run() after instruct()");
  });

  it("prevents mixing run() and instruct()", async () => {
    const testDef: TestDefinition = {
      title: "test-mixed-run-instruct",
      fn: async ({ agent }) => {
        await agent.run("prompt");
        agent.instruct("instruction"); // should throw
      },
    };

    const results = await runTest(testDef, baseConfig);
    expect(results[0].passed).toBe(false);
    expect(results[0].entries[0].reason).toContain("Cannot use instruct() after run()");
  });

  it("declarative with no tasks records as incomplete", async () => {
    const testDef: TestDefinition = {
      title: "test-no-tasks",
      fn: ({ agent }) => {
        agent.instruct("do something");
      },
    };

    const results = await runTest(testDef, baseConfig);
    expect(results[0].passed).toBe(false);
    expect(results[0].entries[0].reason).toContain("without tasks or judge evaluation");
  });

  it("declarative test function is sync (no async needed)", async () => {
    const syncFn = ({
      agent,
      ctx,
    }: {
      agent: { instruct: (p: string) => void };
      ctx: { addTask: (t: unknown) => void };
    }) => {
      agent.instruct("sync instruction");
      ctx.addTask({
        name: "test",
        action: () =>
          Promise.resolve({
            name: "t",
            command: "t",
            stdout: "",
            stderr: "",
            exitCode: 0,
            durationMs: 0,
          }),
        criteria: "pass",
      });
    };

    const testDef: TestDefinition = {
      title: "test-sync",
      fn: syncFn as TestDefinition["fn"],
    };

    const results = await runTest(testDef, baseConfig);
    expect(results).toHaveLength(1);
    expect(runJudge).toHaveBeenCalled();
  });

  it("runs config afterEach commands in declarative mode", async () => {
    const config: AgentEvalConfig = {
      ...baseConfig,
      afterEach: [{ name: "lint", command: "pnpm lint" }],
    };

    const testDef: TestDefinition = {
      title: "test-declarative-after-each",
      fn: ({ agent, ctx }) => {
        agent.instruct("task");
        ctx.addTask({
          name: "build",
          action: () =>
            Promise.resolve({
              name: "b",
              command: "b",
              stdout: "",
              stderr: "",
              exitCode: 0,
              durationMs: 0,
            }),
          criteria: "pass",
        });
      },
    };

    await runTest(testDef, config);
    // env.execute should have been called for: agent instruction + afterEach lint command
    const executeCalls = mockEnvInstance.execute.mock.calls;
    expect(executeCalls.length).toBeGreaterThanOrEqual(2); // agent + lint
  });
});

describe("runner - lifecycle hooks", () => {
  const baseConfig: AgentEvalConfig = {
    rootDir: "/tmp/test",
    outputDir: "/tmp/test/.agenteval",
    runners: [{ name: "mock-cli", type: "cli", command: "echo {{prompt}}" }],
    judge: { provider: "openai", model: "gpt-4o" },
  };

  beforeEach(() => {
    clearLastJudgeResult();
    vi.clearAllMocks();
    mockEnvInstance.execute.mockReturnValue({ stdout: "", stderr: "", exitCode: 0 });
    mockEnvInstance.getDiff.mockReturnValue("mock diff content");
  });

  it("runs beforeEach hooks before test execution", async () => {
    const hookFn = vi.fn();
    vi.mocked(getMatchingHooks).mockReturnValue([{ fn: hookFn, suitePath: [] }]);

    const testDef: TestDefinition = {
      title: "test-before-hook",
      fn: vi.fn().mockResolvedValue(undefined),
    };

    await runTest(testDef, baseConfig);
    // Hook may be called for both beforeEach and afterEach matching
    expect(hookFn).toHaveBeenCalled();
    expect(hookFn.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it("runs config-level beforeEach before DSL hooks", async () => {
    const configBeforeEach = vi.fn();
    const config: AgentEvalConfig = {
      ...baseConfig,
      beforeEach: configBeforeEach,
    };

    const testDef: TestDefinition = {
      title: "test-config-before-hook",
      fn: vi.fn().mockResolvedValue(undefined),
    };

    await runTest(testDef, config);
    expect(configBeforeEach).toHaveBeenCalledOnce();
    expect(configBeforeEach).toHaveBeenCalledWith(
      expect.objectContaining({ ctx: expect.anything() }),
    );
  });

  it("config-level beforeEach can addTask for declarative pipeline", async () => {
    const config: AgentEvalConfig = {
      ...baseConfig,
      beforeEach: ({ ctx }) => {
        ctx.addTask({
          name: "Build",
          action: () =>
            Promise.resolve({
              name: "b",
              command: "b",
              stdout: "",
              stderr: "",
              exitCode: 0,
              durationMs: 0,
            }),
          criteria: "build succeeds",
          weight: 2,
        });
      },
    };

    const testDef: TestDefinition = {
      title: "test-config-before-add-task",
      fn: ({ agent }) => {
        agent.instruct("do something");
      },
    };

    const results = await runTest(testDef, config);
    expect(results).toHaveLength(1);
    // Judge should have been called (declarative pipeline with tasks from config beforeEach)
    expect(runJudge).toHaveBeenCalled();
  });
});

describe("runner - dryRunTest", () => {
  const baseConfig: AgentEvalConfig = {
    rootDir: "/tmp/test",
    runners: [
      { name: "copilot", type: "cli", command: "echo {{prompt}}" },
      {
        name: "claude",
        type: "api",
        api: { provider: "anthropic", model: "claude-sonnet-4-20250514" },
      },
    ],
    judge: { provider: "openai", model: "gpt-4o" },
    afterEach: [{ name: "test", command: "pnpm test" }],
  };

  it("returns plan for declarative test", async () => {
    const testDef: TestDefinition = {
      title: "test-dry-run-declarative",
      fn: ({ agent, ctx }) => {
        agent.instruct("Add a close button");
        ctx.addTask({
          name: "Build",
          action: () =>
            Promise.resolve({
              name: "b",
              command: "b",
              stdout: "",
              stderr: "",
              exitCode: 0,
              durationMs: 0,
            }),
          criteria: "build succeeds",
          weight: 2,
        });
      },
    };

    const plan = await dryRunTest(testDef, baseConfig);
    expect(plan.testId).toBe("test-dry-run-declarative");
    expect(plan.mode).toBe("declarative");
    expect(plan.instruction).toBe("Add a close button");
    expect(plan.tasks).toHaveLength(1);
    expect(plan.tasks[0].name).toBe("Build");
    expect(plan.tasks[0].weight).toBe(2);
    expect(plan.runners).toHaveLength(2);
    expect(plan.afterEachCommands).toEqual(["pnpm test"]);
  });

  it("returns plan for imperative test", async () => {
    const testDef: TestDefinition = {
      title: "test-dry-run-imperative",
      fn: async ({ agent }) => {
        await agent.run("prompt");
      },
    };

    const plan = await dryRunTest(testDef, baseConfig);
    expect(plan.mode).toBe("imperative");
    expect(plan.instruction).toBeUndefined();
  });

  it("respects matrix runner filter", async () => {
    const config: AgentEvalConfig = {
      ...baseConfig,
      matrix: { runners: ["copilot"] },
    };

    const testDef: TestDefinition = {
      title: "test-dry-run-matrix",
      fn: ({ agent }) => {
        agent.instruct("task");
      },
    };

    const plan = await dryRunTest(testDef, config);
    expect(plan.runners).toHaveLength(1);
    expect(plan.runners[0].name).toBe("copilot");
  });
});
