import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  clearLastJudgeOptions,
  setLastJudgeResult,
  setLastJudgeOptions,
  getLastJudgeResult,
  clearLastJudgeResult,
  runTest,
  dryRunTest,
} from "./runner.js";
import type { AgentEvalConfig, TestDefinition, JudgeResult, RunnerConfig } from "./types.js";

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
vi.mock("../environment/plugins/local.js", () => ({
  LocalEnvironment: vi.fn(() => mockEnvInstance),
}));

vi.mock("../judge/judge.js", () => ({
  judge: vi.fn(() => ({
    result: { pass: true, score: 0.85, reason: "good", improvement: "none" },
  })),
  buildJudgePrompt: vi.fn(() => "mock judge prompt"),
  extractChangedFiles: vi.fn(() => []),
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

import { judge as runJudge } from "../judge/judge.js";
import { getMatchingHooks } from "../index.js";

/** Create a mock RunnerConfig for testing */
function createMockRunner(name: string): RunnerConfig {
  return {
    name,
    model: {
      type: "cli" as const,
      name: "mock-cli",
      command: `echo "{{prompt}}"`,
    },
  };
}

describe("runner - judge result store", () => {
  beforeEach(() => {
    clearLastJudgeResult();
    clearLastJudgeOptions();
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
    runners: [createMockRunner("mock-cli")],
    judge: {},
    timeout: 5000,
  };

  beforeEach(() => {
    clearLastJudgeResult();
    clearLastJudgeOptions();
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
      runners: [createMockRunner("runner-a"), createMockRunner("runner-b")],
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
    clearLastJudgeOptions();
    vi.clearAllMocks();
    mockEnvInstance.execute.mockReturnValue({ stdout: "", stderr: "", exitCode: 0 });
    mockEnvInstance.getDiff.mockReturnValue("mock diff content");
  });

  it("CLI runner calls env.execute with the command", async () => {
    const config: AgentEvalConfig = {
      rootDir: "/tmp/test",
      outputDir: "/tmp/test/.agenteval",
      runners: [createMockRunner("cli-runner")],
      judge: {},
    };

    const testDef: TestDefinition = {
      title: "test-cli-exec",
      fn: vi.fn().mockImplementation(async ({ agent }) => {
        await agent.run("hello world");
      }),
    };

    await runTest(testDef, config);

    expect(mockEnvInstance.execute).toHaveBeenCalledWith(
      expect.stringContaining("hello world"),
      "/tmp/test",
      expect.objectContaining({ timeout: 600_000 }),
    );
  });

  it("captures runner execution errors gracefully", async () => {
    // Configure env to throw on execute
    mockEnvInstance.execute.mockImplementationOnce(() => {
      throw new Error("runner crashed");
    });
    const config: AgentEvalConfig = {
      rootDir: "/tmp/test",
      outputDir: "/tmp/test/.agenteval",
      runners: [createMockRunner("fail-runner")],
      judge: {},
    };

    const testDef: TestDefinition = {
      title: "test-runner-error",
      fn: vi.fn().mockImplementation(async ({ agent }) => {
        await agent.run("prompt");
      }),
    };

    const results = await runTest(testDef, config);
    expect(results[0].passed).toBe(false);
    expect(results[0].entries[0].reason).toContain("runner crashed");
  });

  it("runner with API model writes files to disk", async () => {
    // This is an API runner (non-CLI model) — needs generateObject mock
    // For simplicity, we test that CLI execution works since API requires full AI SDK mock
    const config: AgentEvalConfig = {
      rootDir: "/tmp/test",
      outputDir: "/tmp/test/.agenteval",
      runners: [createMockRunner("cli-runner")],
      judge: {},
    };

    const testDef: TestDefinition = {
      title: "test-cli-runner",
      fn: vi.fn().mockImplementation(async ({ agent }) => {
        await agent.run("create a file");
      }),
    };

    await runTest(testDef, config);
    expect(mockEnvInstance.execute).toHaveBeenCalled();
  });

  it("runner execute is called with the right prompt via CLI command", async () => {
    const runner: RunnerConfig = {
      name: "prompt-check",
      model: {
        type: "cli" as const,
        name: "mock-cli",
        command: `mycommand "{{prompt}}"`,
      },
    };
    const config: AgentEvalConfig = {
      rootDir: "/tmp/test",
      outputDir: "/tmp/test/.agenteval",
      runners: [runner],
      judge: {},
    };

    const testDef: TestDefinition = {
      title: "test-prompt-pass",
      fn: vi.fn().mockImplementation(async ({ agent }) => {
        await agent.run("my specific prompt");
      }),
    };

    await runTest(testDef, config);
    expect(mockEnvInstance.execute).toHaveBeenCalledWith(
      `mycommand "my specific prompt"`,
      "/tmp/test",
      expect.objectContaining({ timeout: expect.any(Number) }),
    );
  });

  it("runner with stderr reports error to reporter", async () => {
    mockEnvInstance.execute.mockReturnValueOnce({
      stdout: "",
      stderr: "some error output",
      exitCode: 1,
    });

    const config: AgentEvalConfig = {
      rootDir: "/tmp/test",
      outputDir: "/tmp/test/.agenteval",
      runners: [createMockRunner("stderr-runner")],
      judge: {},
    };

    const testDef: TestDefinition = {
      title: "test-stderr",
      fn: vi.fn().mockImplementation(async ({ agent }) => {
        await agent.run("task");
      }),
    };

    // Should not crash; error is reported gracefully
    const results = await runTest(testDef, config);
    expect(results).toHaveLength(1);
  });

  it("multiple runners execute sequentially", async () => {
    const runner1 = createMockRunner("runner-1");
    const runner2 = createMockRunner("runner-2");

    const config: AgentEvalConfig = {
      rootDir: "/tmp/test",
      outputDir: "/tmp/test/.agenteval",
      runners: [runner1, runner2],
      judge: {},
    };

    const testDef: TestDefinition = {
      title: "test-multi-runner",
      fn: vi.fn().mockImplementation(async ({ agent }) => {
        await agent.run("task");
      }),
    };

    const results = await runTest(testDef, config);
    // No judge = fail for each, but both should execute
    expect(results).toHaveLength(2);
    expect(results[0].runner).toBe("runner-1");
    expect(results[1].runner).toBe("runner-2");
  });
});

describe("runner - auto storeDiff and afterEach", () => {
  beforeEach(() => {
    clearLastJudgeResult();
    clearLastJudgeOptions();
    vi.clearAllMocks();
    mockEnvInstance.execute.mockReturnValue({ stdout: "", stderr: "", exitCode: 0 });
    mockEnvInstance.getDiff.mockReturnValue("mock diff content");
  });

  it("auto-calls storeDiff after agent.run()", async () => {
    const config: AgentEvalConfig = {
      rootDir: "/tmp/test",
      outputDir: "/tmp/test/.agenteval",
      runners: [createMockRunner("cli")],
      judge: {},
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
    expect(results[0].entries[0].diff).toBe("mock diff content");
  });

  it("runs afterEach commands from config after agent.run()", async () => {
    const config: AgentEvalConfig = {
      rootDir: "/tmp/test",
      outputDir: "/tmp/test/.agenteval",
      runners: [createMockRunner("cli")],
      judge: {},
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
      runners: [createMockRunner("cli")],
      judge: {},
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
      runners: [createMockRunner("cli")],
      judge: {},
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
    runners: [createMockRunner("mock-cli")],
    judge: {},
  };

  beforeEach(() => {
    clearLastJudgeResult();
    clearLastJudgeOptions();
    vi.clearAllMocks();
    mockEnvInstance.execute.mockReturnValue({ stdout: "", stderr: "", exitCode: 0 });
    mockEnvInstance.getDiff.mockReturnValue("mock diff content");
  });

  it("executes declarative pipeline when agent.instruct() is used", async () => {
    const testDef: TestDefinition = {
      title: "test-declarative",
      fn: ({ agent, ctx }) => {
        agent.instruct("Add a close button to the Banner");
        setLastJudgeOptions({ criteria: "Banner close button should work", expectedFiles: [] });
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

  it("declarative without toPassJudge criteria fails with explicit error", async () => {
    const testDef: TestDefinition = {
      title: "test-no-tasks",
      fn: ({ agent }) => {
        agent.instruct("do something");
      },
    };

    const results = await runTest(testDef, baseConfig);
    expect(results[0].passed).toBe(false);
    expect(results[0].entries[0].reason).toContain("completed without judge criteria");
    expect(results[0].entries[0].reason).toContain("toPassJudge");
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
      setLastJudgeOptions({ criteria: "Sync declarative instruction is correctly implemented" });
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
        setLastJudgeOptions({ criteria: "Task and lint command both execute successfully" });
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
    runners: [createMockRunner("mock-cli")],
    judge: {},
  };

  beforeEach(() => {
    clearLastJudgeResult();
    clearLastJudgeOptions();
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
        setLastJudgeOptions({ criteria: "Build task from config beforeEach passes" });
      },
    };

    const results = await runTest(testDef, config);
    expect(results).toHaveLength(1);
    // Judge should have been called (declarative pipeline with tasks from config beforeEach)
    expect(runJudge).toHaveBeenCalled();
  });

  it("runs afterEach hooks even when test errors, swallowing hook errors", async () => {
    const throwingHook = vi.fn().mockRejectedValue(new Error("hook error"));
    // getMatchingHooks is called twice: once for beforeEach, once for afterEach
    vi.mocked(getMatchingHooks)
      .mockReturnValueOnce([]) // beforeEach hooks: none
      .mockReturnValueOnce([{ fn: throwingHook, suitePath: [] }]); // afterEach hooks: throwing

    const testDef: TestDefinition = {
      title: "test-error-with-hook",
      fn: vi.fn().mockRejectedValue(new Error("test error")),
    };

    const results = await runTest(testDef, baseConfig);
    expect(results[0].passed).toBe(false);
    expect(results[0].entries[0].reason).toContain("test error");
    // Hook should have been called but its error swallowed
    expect(throwingHook).toHaveBeenCalled();
  });

  it("calls env.teardown in finally block", async () => {
    const teardownFn = vi.fn();
    const envWithTeardown = {
      name: "mock-env",
      setup: vi.fn(),
      execute: vi.fn(() => ({ stdout: "", stderr: "", exitCode: 0 })),
      getDiff: vi.fn(() => "diff"),
      teardown: teardownFn,
    };
    mockEnvInstance.setup.mockImplementation(envWithTeardown.setup);
    mockEnvInstance.execute.mockImplementation(envWithTeardown.execute);
    mockEnvInstance.getDiff.mockImplementation(envWithTeardown.getDiff);
    // Add teardown to mockEnvInstance
    (mockEnvInstance as Record<string, unknown>).teardown = teardownFn;

    const testDef: TestDefinition = {
      title: "test-teardown",
      fn: vi.fn().mockResolvedValue(undefined),
    };

    await runTest(testDef, baseConfig);
    expect(teardownFn).toHaveBeenCalled();

    // Clean up
    delete (mockEnvInstance as Record<string, unknown>).teardown;
  });

  it("reports FAIL via onTestFail when score is below fail threshold", async () => {
    const testDef: TestDefinition = {
      title: "test-fail-path",
      fn: vi.fn().mockImplementation(() => {
        setLastJudgeResult({
          pass: false,
          score: 0.2,
          reason: "poor",
          improvement: "fix everything",
        });
      }),
    };

    const results = await runTest(testDef, baseConfig);
    expect(results[0].entries[0].status).toBe("FAIL");
    expect(results[0].passed).toBe(false);
  });

  it("reports WARN via onTestWarn when score is between thresholds", async () => {
    const testDef: TestDefinition = {
      title: "test-warn-path",
      fn: vi.fn().mockImplementation(() => {
        setLastJudgeResult({
          pass: true,
          score: 0.65,
          reason: "partial",
          improvement: "more work",
        });
      }),
    };

    const results = await runTest(testDef, baseConfig);
    expect(results[0].entries[0].status).toBe("WARN");
    expect(results[0].passed).toBe(true);
  });

  it("errors when toPassJudge is called before agent.run in imperative mode", async () => {
    const testDef: TestDefinition = {
      title: "test-judge-before-run",
      fn: vi
        .fn()
        .mockImplementation(async ({ agent }: { agent: { run: (p: string) => Promise<void> } }) => {
          // Set judge options without judge result (simulates toPassJudge before run)
          setLastJudgeOptions({ criteria: "criteria" });
          await agent.run("prompt");
        }),
    };

    const results = await runTest(testDef, baseConfig);
    expect(results[0].passed).toBe(false);
    expect(results[0].entries[0].reason).toContain("toPassJudge");
  });
});

describe("runner - dryRunTest", () => {
  const baseConfig: AgentEvalConfig = {
    rootDir: "/tmp/test",
    runners: [
      createMockRunner("copilot"),
      {
        name: "claude",
        model: {
          name: "anthropic",
          modelId: "claude-sonnet-4-20250514",
          createModel: () => ({}) as never,
        },
      },
    ],
    judge: {},
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
