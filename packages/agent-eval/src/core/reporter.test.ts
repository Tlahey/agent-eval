import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { LedgerEntry } from "./types.js";
import type { TestEvent, TestResultEvent } from "./reporter.js";
import { DefaultReporter, SilentReporter, VerboseReporter } from "./reporter.js";

// Mock chalk to return raw strings for easy assertions
vi.mock("chalk", () => {
  const identity = (s: string) => s;
  const fn = Object.assign(identity, {
    blue: identity,
    gray: identity,
    dim: identity,
    green: identity,
    red: identity,
    yellow: identity,
    bold: identity,
  });
  return { default: fn };
});

// Mock ora
vi.mock("ora", () => {
  const spinner = {
    text: "",
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
  };
  return { default: vi.fn(() => spinner) };
});

function makeLedgerEntry(overrides: Partial<LedgerEntry> = {}): LedgerEntry {
  return {
    testId: "test-1",
    suitePath: [],
    timestamp: "2024-01-01T00:00:00.000Z",
    agentRunner: "runner-a",
    judgeModel: "gpt-4",
    score: 0.85,
    pass: true,
    reason: "Good implementation",
    improvement: "Could add more tests",
    context: { diff: "diff content", commands: [] },
    durationMs: 1500,
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
    reporter.onTestPass(makeResultEvent());
    reporter.onTestFail(makeResultEvent({ entry: makeLedgerEntry({ pass: false }) }));
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

  it("prints file path on onFileStart", () => {
    const reporter = new DefaultReporter();
    reporter.onFileStart("evals/test.eval.ts");
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("evals/test.eval.ts"));
  });

  it("uses ora spinner on onTestStart", async () => {
    const ora = await import("ora");
    const reporter = new DefaultReporter();
    reporter.onTestStart(makeTestEvent());
    expect(ora.default).toHaveBeenCalled();
  });

  it("calls spinner.succeed on onTestPass", async () => {
    const ora = await import("ora");
    const spinner = (ora.default as unknown as ReturnType<typeof vi.fn>)();
    const reporter = new DefaultReporter();
    reporter.onTestStart(makeTestEvent());
    reporter.onTestPass(makeResultEvent());
    expect(spinner.succeed).toHaveBeenCalled();
  });

  it("calls spinner.fail on onTestFail", async () => {
    const ora = await import("ora");
    const spinner = (ora.default as unknown as ReturnType<typeof vi.fn>)();
    const reporter = new DefaultReporter();
    reporter.onTestStart(makeTestEvent());
    reporter.onTestFail(makeResultEvent({ entry: makeLedgerEntry({ pass: false, score: 0.3 }) }));
    expect(spinner.fail).toHaveBeenCalled();
  });

  it("calls spinner.fail on onTestError", async () => {
    const ora = await import("ora");
    const spinner = (ora.default as unknown as ReturnType<typeof vi.fn>)();
    const reporter = new DefaultReporter();
    reporter.onTestStart(makeTestEvent());
    reporter.onTestError(makeTestEvent(), "some error");
    expect(spinner.fail).toHaveBeenCalled();
  });

  it("prints summary table on onRunEnd", () => {
    const reporter = new DefaultReporter();
    const results = [
      makeResultEvent(),
      makeResultEvent({
        testId: "test-2",
        entry: makeLedgerEntry({ testId: "test-2", pass: false, score: 0.2 }),
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

  it("prints PASS with reason on onTestPass", () => {
    const reporter = new VerboseReporter();
    reporter.onTestPass(makeResultEvent());
    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("PASS");
    expect(output).toContain("Reason:");
  });

  it("prints FAIL with reason and improvement on onTestFail", () => {
    const reporter = new VerboseReporter();
    reporter.onTestFail(
      makeResultEvent({
        entry: makeLedgerEntry({
          pass: false,
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
