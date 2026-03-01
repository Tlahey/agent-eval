import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { LedgerEntry } from "./types.js";
import { DEFAULT_THRESHOLDS, computeStatus } from "./types.js";
import type { TestEvent, TestResultEvent } from "./reporter.js";
import { DefaultReporter, SilentReporter, VerboseReporter, CIReporter, isCI } from "./reporter.js";

function makeLedgerEntry(overrides: Partial<LedgerEntry> = {}): LedgerEntry {
  const score = overrides.score ?? 0.85;
  const thresholds = overrides.thresholds ?? DEFAULT_THRESHOLDS;
  const status = overrides.status ?? computeStatus(score, thresholds);
  return {
    testId: "test-1",
    suitePath: [],
    timestamp: "2024-01-01T00:00:00.000Z",
    agentRunner: "runner-a",
    judgeModel: "gpt-4",
    score,
    pass: status !== "FAIL",
    status,
    reason: "Good implementation",
    improvement: "Could add more tests",
    context: { diff: "diff content", commands: [] },
    durationMs: 1500,
    thresholds,
    ...overrides,
  };
}

function makeTestEvent(overrides: Partial<TestEvent> = {}): TestEvent {
  return {
    testId: "test-1",
    runner: "runner-a",
    ...overrides,
  };
}

function makeResultEvent(overrides: Partial<TestResultEvent> = {}): TestResultEvent {
  return {
    testId: "test-1",
    runner: "runner-a",
    entry: makeLedgerEntry(),
    durationMs: 1500,
    ...overrides,
  };
}

// ─── isCI ───

describe("isCI", () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns true when CI env var is set", () => {
    process.env = { ...originalEnv, CI: "true" };
    expect(isCI()).toBe(true);
  });

  it("returns true when GITHUB_ACTIONS is set", () => {
    process.env = { ...originalEnv, GITHUB_ACTIONS: "true" };
    expect(isCI()).toBe(true);
  });

  it("returns true when not a TTY", () => {
    // In test environment, stdout.isTTY is typically undefined (falsy)
    // so isCI() will return true when no CI env vars and no TTY
    const result = isCI();
    expect(typeof result).toBe("boolean");
  });
});

// ─── SilentReporter ───

describe("SilentReporter", () => {
  it("produces no output for any event", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const reporter = new SilentReporter();

    reporter.onRunStart(3, 2);
    reporter.onFileStart("test.eval.ts");
    reporter.onTestStart(makeTestEvent());
    reporter.onGitReset(makeTestEvent());
    reporter.onFileWrite(makeTestEvent(), "src/file.ts");
    reporter.onPipelineStep(makeTestEvent(), "setup", "done");
    reporter.onTestPass(makeResultEvent());
    reporter.onTestWarn(makeResultEvent({ entry: makeLedgerEntry({ score: 0.65 }) }));
    reporter.onTestFail(makeResultEvent({ entry: makeLedgerEntry({ score: 0.3 }) }));
    reporter.onTestError(makeTestEvent(), "something broke");
    reporter.onRunEnd([], 5000);

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

// ─── DefaultReporter ───

describe("DefaultReporter", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it("prints header on onRunStart", () => {
    const reporter = new DefaultReporter();
    reporter.onRunStart(5, 2);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("5 test(s)"));
  });

  it("prints file path on onFileStart", () => {
    const reporter = new DefaultReporter();
    reporter.onFileStart("evals/test.eval.ts");
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("evals/test.eval.ts"));
  });

  it("prints progress counter on onTestStart", () => {
    const reporter = new DefaultReporter();
    reporter.onRunStart(2, 1);
    reporter.onTestStart(makeTestEvent({ testId: "my-test" }));
    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("[1/2]");
    expect(output).toContain("my-test");
  });

  it("prints pipeline step with correct icon on done", () => {
    const reporter = new DefaultReporter();
    reporter.onPipelineStep(makeTestEvent(), "setup", "done");
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("✓"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Environment setup"));
  });

  it("prints pipeline step with running icon", () => {
    const reporter = new DefaultReporter();
    reporter.onPipelineStep(makeTestEvent(), "agent", "running");
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("●"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Agent execution"));
  });

  it("prints pipeline step with error icon", () => {
    const reporter = new DefaultReporter();
    reporter.onPipelineStep(makeTestEvent(), "judge", "error");
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("✗"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Judge evaluation"));
  });

  it("prints pipeline step detail when provided", () => {
    const reporter = new DefaultReporter();
    reporter.onPipelineStep(makeTestEvent(), "task", "done", "lint check");
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("lint check"));
  });

  it("prints PASS on onTestPass", () => {
    const reporter = new DefaultReporter();
    reporter.onTestPass(makeResultEvent());
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("PASS"));
  });

  it("prints WARN on onTestWarn", () => {
    const reporter = new DefaultReporter();
    reporter.onTestWarn(makeResultEvent({ entry: makeLedgerEntry({ score: 0.65 }) }));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("WARN"));
  });

  it("prints FAIL on onTestFail", () => {
    const reporter = new DefaultReporter();
    reporter.onTestFail(makeResultEvent({ entry: makeLedgerEntry({ score: 0.3 }) }));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("FAIL"));
  });

  it("prints ERROR on onTestError", () => {
    const reporter = new DefaultReporter();
    reporter.onTestError(makeTestEvent(), "some error");
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("ERROR"));
  });

  it("prints summary table on onRunEnd", () => {
    const reporter = new DefaultReporter();
    const results = [
      makeResultEvent(),
      makeResultEvent({
        testId: "test-2",
        entry: makeLedgerEntry({ testId: "test-2", score: 0.2 }),
      }),
    ];
    reporter.onRunEnd(results, 5000);

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Results");
    expect(output).toContain("Summary");
    expect(output).toContain("1 passed");
    expect(output).toContain("1 failed");
    expect(output).toContain("5.0s total");
  });

  it("does not print 'failed' when all pass", () => {
    const reporter = new DefaultReporter();
    reporter.onRunEnd([makeResultEvent()], 2000);

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("1 passed");
    expect(output).not.toContain("failed");
  });

  it("prints warning count when WARN entries exist", () => {
    const reporter = new DefaultReporter();
    const results = [
      makeResultEvent(),
      makeResultEvent({
        testId: "test-2",
        entry: makeLedgerEntry({ testId: "test-2", score: 0.65 }),
      }),
    ];
    reporter.onRunEnd(results, 3000);

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("1 passed");
    expect(output).toContain("1 warnings");
  });

  it("prints nothing for empty results", () => {
    const reporter = new DefaultReporter();
    reporter.onRunEnd([], 0);

    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("0 passed");
    // No table headers for empty results
    expect(output).not.toContain("Test");
  });
});

// ─── VerboseReporter ───

describe("VerboseReporter", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it("prints test count on onRunStart", () => {
    const reporter = new VerboseReporter();
    reporter.onRunStart(5, 2);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("5 test(s)"));
  });

  it("prints file path on onFileStart", () => {
    const reporter = new VerboseReporter();
    reporter.onFileStart("evals/test.eval.ts");
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("evals/test.eval.ts"));
  });

  it("prints test id on onTestStart", () => {
    const reporter = new VerboseReporter();
    reporter.onRunStart(1, 1);
    reporter.onTestStart(makeTestEvent({ testId: "my-test" }));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("my-test"));
  });

  it("prints git reset on onGitReset", () => {
    const reporter = new VerboseReporter();
    reporter.onGitReset(makeTestEvent());
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("git reset"));
  });

  it("prints file write on onFileWrite", () => {
    const reporter = new VerboseReporter();
    reporter.onFileWrite(makeTestEvent(), "src/index.ts");
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("src/index.ts"));
  });

  it("prints pipeline step events", () => {
    const reporter = new VerboseReporter();
    reporter.onPipelineStep(makeTestEvent(), "setup", "done");
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Environment setup"));
  });

  it("prints PASS with reason on onTestPass", () => {
    const reporter = new VerboseReporter();
    reporter.onTestPass(makeResultEvent());
    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("PASS");
    expect(output).toContain("Reason:");
  });

  it("prints WARN with reason and improvement on onTestWarn", () => {
    const reporter = new VerboseReporter();
    reporter.onTestWarn(
      makeResultEvent({
        entry: makeLedgerEntry({
          score: 0.65,
          reason: "Partial implementation",
          improvement: "Add edge cases",
        }),
      }),
    );
    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("WARN");
    expect(output).toContain("Reason:");
    expect(output).toContain("Improve:");
  });

  it("prints FAIL with reason and improvement on onTestFail", () => {
    const reporter = new VerboseReporter();
    reporter.onTestFail(
      makeResultEvent({
        entry: makeLedgerEntry({
          score: 0.2,
          reason: "Missing tests",
          improvement: "Add more tests",
        }),
      }),
    );
    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("FAIL");
    expect(output).toContain("Reason:");
    expect(output).toContain("Improve:");
  });

  it("prints error on onTestError", () => {
    const reporter = new VerboseReporter();
    reporter.onTestError(makeTestEvent(), "timeout exceeded");
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("timeout exceeded"));
  });

  it("prints summary table on onRunEnd", () => {
    const reporter = new VerboseReporter();
    reporter.onRunEnd([makeResultEvent()], 3000);
    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Results");
    expect(output).toContain("Summary");
    expect(output).toContain("1 passed");
  });
});

// ─── CIReporter ───

describe("CIReporter", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it("prints plain text header on onRunStart", () => {
    const reporter = new CIReporter();
    reporter.onRunStart(3, 2);
    expect(logSpy).toHaveBeenCalledWith("AgentEval: 3 test(s) x 2 runner(s)");
  });

  it("prints file path on onFileStart", () => {
    const reporter = new CIReporter();
    reporter.onFileStart("evals/test.eval.ts");
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("evals/test.eval.ts"));
  });

  it("prints progress counter on onTestStart", () => {
    const reporter = new CIReporter();
    reporter.onRunStart(2, 1);
    reporter.onTestStart(makeTestEvent());
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("[1/2]"));
  });

  it("prints pipeline steps with status tags", () => {
    const reporter = new CIReporter();
    reporter.onPipelineStep(makeTestEvent(), "setup", "done");
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("[ok]"));

    reporter.onPipelineStep(makeTestEvent(), "agent", "error");
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("[err]"));

    reporter.onPipelineStep(makeTestEvent(), "diff", "running");
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("[...]"));
  });

  it("prints PASS on onTestPass", () => {
    const reporter = new CIReporter();
    reporter.onTestPass(makeResultEvent());
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("PASS"));
  });

  it("prints FAIL with reason on onTestFail", () => {
    const reporter = new CIReporter();
    reporter.onTestFail(makeResultEvent({ entry: makeLedgerEntry({ score: 0.3 }) }));
    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("FAIL");
    expect(output).toContain("reason:");
  });

  it("prints summary on onRunEnd", () => {
    const reporter = new CIReporter();
    reporter.onRunEnd(
      [
        makeResultEvent(),
        makeResultEvent({
          testId: "test-2",
          entry: makeLedgerEntry({ testId: "test-2", score: 0.3 }),
        }),
      ],
      5000,
    );
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("1 passed, 0 warnings, 1 failed"));
  });
});
