import pc from "picocolors";
import type { LedgerEntry } from "./types.js";

// ─── CI Environment Detection ───

/**
 * Detect if running in a CI/non-interactive environment.
 * Checks common CI env vars and TTY status.
 */
export function isCI(): boolean {
  return !!(
    process.env.CI ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.JENKINS_URL ||
    process.env.CIRCLECI ||
    process.env.BUILDKITE ||
    process.env.TF_BUILD ||
    process.env.CODEBUILD_BUILD_ID ||
    !process.stdout.isTTY
  );
}

// ─── Pipeline Step Types ───

export type PipelineStep = "setup" | "agent" | "diff" | "afterEach" | "task" | "judge";

export type StepStatus = "running" | "done" | "error";

// ─── Reporter Interface ───

export interface TestEvent {
  testId: string;
  runner: string;
  suitePath?: string[];
}

export interface TestResultEvent extends TestEvent {
  entry: LedgerEntry;
  durationMs: number;
}

/**
 * Reporter interface for CLI output.
 * The runner emits events through these methods instead of using console.log directly.
 */
export interface Reporter {
  /** Called once at the start of the entire run */
  onRunStart(totalTests: number, totalRunners: number): void;
  /** Called when a test file is loaded */
  onFileStart(filePath: string): void;
  /** Called before a test starts executing with a specific runner */
  onTestStart(event: TestEvent): void;
  /** Called when git reset is performed */
  onGitReset(event: TestEvent): void;
  /** Called when a file is written by an API runner */
  onFileWrite(event: TestEvent, filePath: string): void;
  /** Called when a pipeline step starts or completes */
  onPipelineStep(event: TestEvent, step: PipelineStep, status: StepStatus, detail?: string): void;
  /** Called when a test passes */
  onTestPass(event: TestResultEvent): void;
  /** Called when a test gets a warning (score between fail and warn thresholds) */
  onTestWarn(event: TestResultEvent): void;
  /** Called when a test fails */
  onTestFail(event: TestResultEvent): void;
  /** Called when a test errors */
  onTestError(event: TestEvent, error: string): void;
  /** Called at the end of the entire run with all results */
  onRunEnd(results: TestResultEvent[], durationMs: number): void;
}

// ─── Step labels ───

const STEP_LABELS: Record<PipelineStep, string> = {
  setup: "Environment setup",
  agent: "Agent execution",
  diff: "Diff capture",
  afterEach: "Post-agent commands",
  task: "Task verification",
  judge: "Judge evaluation",
};

const STEP_ICON_DONE = "✓";
const STEP_ICON_FAIL = "✗";
const STEP_ICON_RUN = "●";

// ─── Default Reporter (non-TUI, scrollback-safe with pipeline steps) ───

export class DefaultReporter implements Reporter {
  private progress = { current: 0, total: 0 };

  onRunStart(totalTests: number, totalRunners: number): void {
    this.progress.total = totalTests * totalRunners;
    this.progress.current = 0;
    console.log(pc.bold(`\n🧪 AgentEval — ${totalTests} test(s) × ${totalRunners} runner(s)\n`));
  }

  onFileStart(filePath: string): void {
    console.log(pc.bold(`📄 ${filePath}`));
  }

  onTestStart(event: TestEvent): void {
    this.progress.current++;
    const counter = pc.dim(`[${this.progress.current}/${this.progress.total}]`);
    console.log(`\n  ${counter} ${pc.blue(event.testId)} ${pc.gray(`[${event.runner}]`)}`);
  }

  onGitReset(_event: TestEvent): void {
    // Covered by onPipelineStep(setup)
  }

  onFileWrite(_event: TestEvent, filePath: string): void {
    console.log(pc.dim(`       📝 ${filePath}`));
  }

  onPipelineStep(_event: TestEvent, step: PipelineStep, status: StepStatus, detail?: string): void {
    const label = STEP_LABELS[step];
    const suffix = detail ? pc.dim(` ${detail}`) : "";
    if (status === "running") {
      console.log(`    ${pc.cyan(STEP_ICON_RUN)} ${label}...${suffix}`);
    } else if (status === "done") {
      console.log(`    ${pc.green(STEP_ICON_DONE)} ${label}${suffix}`);
    } else {
      console.log(`    ${pc.red(STEP_ICON_FAIL)} ${label}${suffix}`);
    }
  }

  onTestPass(event: TestResultEvent): void {
    const score = pc.yellow(event.entry.score.toFixed(2));
    const dur = pc.dim(`${(event.durationMs / 1000).toFixed(1)}s`);
    console.log(`  ${pc.green("✓ PASS")} ${score} ${dur}`);
  }

  onTestWarn(event: TestResultEvent): void {
    const score = pc.yellow(event.entry.score.toFixed(2));
    const dur = pc.dim(`${(event.durationMs / 1000).toFixed(1)}s`);
    console.log(`  ${pc.yellow("⚠ WARN")} ${score} ${dur}`);
  }

  onTestFail(event: TestResultEvent): void {
    const score = pc.yellow(event.entry.score.toFixed(2));
    const dur = pc.dim(`${(event.durationMs / 1000).toFixed(1)}s`);
    console.log(`  ${pc.red("✗ FAIL")} ${score} ${dur}`);
  }

  onTestError(_event: TestEvent, error: string): void {
    console.log(`  ${pc.red("✗ ERROR")} ${pc.red(error)}`);
  }

  onRunEnd(results: TestResultEvent[], durationMs: number): void {
    printSummaryTable(results);
    printSummaryFooter(results, durationMs);
  }
}

// ─── Silent Reporter (no output — for CI or programmatic use) ───

export class SilentReporter implements Reporter {
  onRunStart(_totalTests: number, _totalRunners: number): void {}
  onFileStart(_filePath: string): void {}
  onTestStart(_event: TestEvent): void {}
  onGitReset(_event: TestEvent): void {}
  onFileWrite(_event: TestEvent, _filePath: string): void {}
  onPipelineStep(
    _event: TestEvent,
    _step: PipelineStep,
    _status: StepStatus,
    _detail?: string,
  ): void {}
  onTestPass(_event: TestResultEvent): void {}
  onTestWarn(_event: TestResultEvent): void {}
  onTestFail(_event: TestResultEvent): void {}
  onTestError(_event: TestEvent, _error: string): void {}
  onRunEnd(_results: TestResultEvent[], _durationMs: number): void {}
}

// ─── Verbose Reporter (detailed output with full reasoning) ───

export class VerboseReporter implements Reporter {
  private progress = { current: 0, total: 0 };

  onRunStart(totalTests: number, totalRunners: number): void {
    this.progress.total = totalTests * totalRunners;
    this.progress.current = 0;
    console.log(pc.bold(`\n🧪 AgentEval — ${totalTests} test(s) × ${totalRunners} runner(s)\n`));
  }

  onFileStart(filePath: string): void {
    console.log(pc.bold(`\n📄 ${filePath}`));
  }

  onTestStart(event: TestEvent): void {
    this.progress.current++;
    const counter = pc.dim(`[${this.progress.current}/${this.progress.total}]`);
    console.log(`\n  ${counter} ${pc.blue(event.testId)} ${pc.gray(`[${event.runner}]`)}`);
  }

  onGitReset(_event: TestEvent): void {
    console.log(pc.dim("    ↺ git reset --hard && git clean -fd"));
  }

  onFileWrite(_event: TestEvent, filePath: string): void {
    console.log(pc.dim(`       📝 ${filePath}`));
  }

  onPipelineStep(_event: TestEvent, step: PipelineStep, status: StepStatus, detail?: string): void {
    const label = STEP_LABELS[step];
    const suffix = detail ? pc.dim(` ${detail}`) : "";
    if (status === "running") {
      console.log(`    ${pc.cyan(STEP_ICON_RUN)} ${label}...${suffix}`);
    } else if (status === "done") {
      console.log(`    ${pc.green(STEP_ICON_DONE)} ${label}${suffix}`);
    } else {
      console.log(`    ${pc.red(STEP_ICON_FAIL)} ${label}${suffix}`);
    }
  }

  onTestPass(event: TestResultEvent): void {
    const score = pc.yellow(event.entry.score.toFixed(2));
    const dur = pc.dim(`${(event.durationMs / 1000).toFixed(1)}s`);
    console.log(`  ${pc.green("✓ PASS")} ${score} ${dur}`);
    if (event.entry.reason) {
      console.log(pc.dim(`    Reason: ${truncate(event.entry.reason, 120)}`));
    }
  }

  onTestWarn(event: TestResultEvent): void {
    const score = pc.yellow(event.entry.score.toFixed(2));
    const dur = pc.dim(`${(event.durationMs / 1000).toFixed(1)}s`);
    console.log(`  ${pc.yellow("⚠ WARN")} ${score} ${dur}`);
    if (event.entry.reason) {
      console.log(pc.dim(`    Reason: ${truncate(event.entry.reason, 120)}`));
    }
    if (event.entry.improvement) {
      console.log(pc.dim(`    Improve: ${truncate(event.entry.improvement, 120)}`));
    }
  }

  onTestFail(event: TestResultEvent): void {
    const score = pc.yellow(event.entry.score.toFixed(2));
    const dur = pc.dim(`${(event.durationMs / 1000).toFixed(1)}s`);
    console.log(`  ${pc.red("✗ FAIL")} ${score} ${dur}`);
    if (event.entry.reason) {
      console.log(pc.dim(`    Reason: ${truncate(event.entry.reason, 120)}`));
    }
    if (event.entry.improvement) {
      console.log(pc.dim(`    Improve: ${truncate(event.entry.improvement, 120)}`));
    }
  }

  onTestError(_event: TestEvent, error: string): void {
    console.log(`  ${pc.red("✗ ERROR")} ${pc.red(error)}`);
  }

  onRunEnd(results: TestResultEvent[], durationMs: number): void {
    printSummaryTable(results);
    printSummaryFooter(results, durationMs);
  }
}

// ─── CI Reporter (static logging, no colors, no animations) ───

export class CIReporter implements Reporter {
  private progress = { current: 0, total: 0 };

  onRunStart(totalTests: number, totalRunners: number): void {
    this.progress.total = totalTests * totalRunners;
    this.progress.current = 0;
    console.log(`AgentEval: ${totalTests} test(s) x ${totalRunners} runner(s)`);
  }

  onFileStart(filePath: string): void {
    console.log(`\nFile: ${filePath}`);
  }

  onTestStart(event: TestEvent): void {
    this.progress.current++;
    console.log(
      `[${this.progress.current}/${this.progress.total}] ${event.testId} [${event.runner}]`,
    );
  }

  onGitReset(_event: TestEvent): void {}

  onFileWrite(_event: TestEvent, filePath: string): void {
    console.log(`  wrote: ${filePath}`);
  }

  onPipelineStep(_event: TestEvent, step: PipelineStep, status: StepStatus, detail?: string): void {
    const label = STEP_LABELS[step];
    const suffix = detail ? ` ${detail}` : "";
    console.log(
      `  ${status === "done" ? "[ok]" : status === "error" ? "[err]" : "[...]"} ${label}${suffix}`,
    );
  }

  onTestPass(event: TestResultEvent): void {
    console.log(
      `  PASS score=${event.entry.score.toFixed(2)} ${(event.durationMs / 1000).toFixed(1)}s`,
    );
  }

  onTestWarn(event: TestResultEvent): void {
    console.log(
      `  WARN score=${event.entry.score.toFixed(2)} ${(event.durationMs / 1000).toFixed(1)}s`,
    );
  }

  onTestFail(event: TestResultEvent): void {
    console.log(
      `  FAIL score=${event.entry.score.toFixed(2)} ${(event.durationMs / 1000).toFixed(1)}s`,
    );
    if (event.entry.reason) {
      console.log(`  reason: ${truncate(event.entry.reason, 200)}`);
    }
  }

  onTestError(_event: TestEvent, error: string): void {
    console.log(`  ERROR: ${error}`);
  }

  onRunEnd(results: TestResultEvent[], durationMs: number): void {
    const passed = results.filter((r) => r.entry.status === "PASS").length;
    const warned = results.filter((r) => r.entry.status === "WARN").length;
    const failed = results.filter((r) => r.entry.status === "FAIL").length;
    console.log(
      `\nSummary: ${passed} passed, ${warned} warnings, ${failed} failed (${(durationMs / 1000).toFixed(1)}s)`,
    );
  }
}

// ─── Summary Table ───

function printSummaryTable(results: TestResultEvent[]): void {
  if (results.length === 0) return;

  const testCol = Math.max(6, ...results.map((r) => r.testId.length)) + 2;
  const runnerCol = Math.max(8, ...results.map((r) => r.runner.length)) + 2;

  const hdr =
    pc.dim("  ") +
    pad("Test", testCol) +
    pad("Runner", runnerCol) +
    pad("Score", 8) +
    pad("Status", 8) +
    pad("Duration", 10);

  const sep = pc.dim("  " + "─".repeat(testCol + runnerCol + 8 + 8 + 10));

  console.log(pc.bold("\n─── Results ───\n"));
  console.log(hdr);
  console.log(sep);

  for (const r of results) {
    const statusMap = {
      PASS: pc.green("PASS"),
      WARN: pc.yellow("WARN"),
      FAIL: pc.red("FAIL"),
    };
    const status = statusMap[r.entry.status] ?? pc.red("FAIL");
    const score = pc.yellow(r.entry.score.toFixed(2));
    const dur = `${(r.durationMs / 1000).toFixed(1)}s`;

    console.log(
      pc.dim("  ") +
        pad(r.testId, testCol) +
        pad(r.runner, runnerCol) +
        pad(score, 8) +
        pad(status, 8) +
        pad(dur, 10),
    );
  }
}

function printSummaryFooter(results: TestResultEvent[], durationMs: number): void {
  const passed = results.filter((r) => r.entry.status === "PASS").length;
  const warned = results.filter((r) => r.entry.status === "WARN").length;
  const failed = results.filter((r) => r.entry.status === "FAIL").length;

  console.log(pc.bold("\n─── Summary ───"));
  console.log(pc.green(`  ✓ ${passed} passed`));
  if (warned > 0) {
    console.log(pc.yellow(`  ⚠ ${warned} warnings`));
  }
  if (failed > 0) {
    console.log(pc.red(`  ✗ ${failed} failed`));
  }
  console.log(pc.dim(`  ⏱ ${(durationMs / 1000).toFixed(1)}s total\n`));
}

// ─── Helpers ───

function pad(str: string, width: number): string {
  // Strip ANSI for length calculation
  // eslint-disable-next-line no-control-regex
  const stripped = str.replace(/\x1b\[[0-9;]*m/g, "");
  const diff = width - stripped.length;
  return diff > 0 ? str + " ".repeat(diff) : str;
}

function truncate(str: string, max: number): string {
  const oneLine = str.replace(/\n/g, " ").trim();
  return oneLine.length > max ? oneLine.slice(0, max - 3) + "..." : oneLine;
}
