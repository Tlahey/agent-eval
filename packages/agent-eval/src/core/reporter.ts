import chalk from "chalk";
import ora, { type Ora } from "ora";
import type { LedgerEntry } from "./types.js";

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
  /** Called when a test passes */
  onTestPass(event: TestResultEvent): void;
  /** Called when a test fails */
  onTestFail(event: TestResultEvent): void;
  /** Called when a test errors */
  onTestError(event: TestEvent, error: string): void;
  /** Called at the end of the entire run with all results */
  onRunEnd(results: TestResultEvent[], durationMs: number): void;
}

// ─── Default Reporter (rich terminal output with spinners and summary table) ───

export class DefaultReporter implements Reporter {
  private spinner: Ora | null = null;

  onRunStart(): void {
    // Intentionally empty — executeRun prints its own header
  }

  onFileStart(filePath: string): void {
    console.log(chalk.bold(`\n📄 ${filePath}`));
  }

  onTestStart(event: TestEvent): void {
    this.spinner = ora({
      text: `${chalk.blue(event.testId)} ${chalk.gray(`[${event.runner}]`)}`,
      spinner: "dots",
    }).start();
  }

  onGitReset(): void {
    // Spinner is already running — no additional output needed
  }

  onFileWrite(_event: TestEvent, filePath: string): void {
    if (this.spinner) {
      this.spinner.text += chalk.dim(` 📝 ${filePath}`);
    }
  }

  onTestPass(event: TestResultEvent): void {
    const score = chalk.yellow(event.entry.score.toFixed(2));
    const dur = chalk.dim(`${(event.durationMs / 1000).toFixed(1)}s`);
    if (this.spinner) {
      this.spinner.succeed(
        `${chalk.blue(event.testId)} ${chalk.gray(`[${event.runner}]`)} ${chalk.green("PASS")} ${score} ${dur}`,
      );
      this.spinner = null;
    }
  }

  onTestFail(event: TestResultEvent): void {
    const score = chalk.yellow(event.entry.score.toFixed(2));
    const dur = chalk.dim(`${(event.durationMs / 1000).toFixed(1)}s`);
    if (this.spinner) {
      this.spinner.fail(
        `${chalk.blue(event.testId)} ${chalk.gray(`[${event.runner}]`)} ${chalk.red("FAIL")} ${score} ${dur}`,
      );
      this.spinner = null;
    }
  }

  onTestError(event: TestEvent, error: string): void {
    if (this.spinner) {
      this.spinner.fail(
        `${chalk.blue(event.testId)} ${chalk.gray(`[${event.runner}]`)} ${chalk.red("ERROR")}`,
      );
      this.spinner = null;
    }
    console.log(chalk.red(`    ${error}`));
  }

  onRunEnd(results: TestResultEvent[], durationMs: number): void {
    const passed = results.filter((r) => r.entry.pass).length;
    const failed = results.length - passed;

    console.log("");
    printSummaryTable(results);

    console.log(chalk.bold("\n─── Summary ───"));
    console.log(chalk.green(`  ✓ ${passed} passed`));
    if (failed > 0) {
      console.log(chalk.red(`  ✗ ${failed} failed`));
    }
    console.log(chalk.dim(`  ⏱ ${(durationMs / 1000).toFixed(1)}s total\n`));
  }
}

// ─── Silent Reporter (no output — for CI or programmatic use) ───

export class SilentReporter implements Reporter {
  onRunStart(): void {}
  onFileStart(): void {}
  onTestStart(): void {}
  onGitReset(): void {}
  onFileWrite(): void {}
  onTestPass(): void {}
  onTestFail(): void {}
  onTestError(): void {}
  onRunEnd(): void {}
}

// ─── Verbose Reporter (detailed output with full reasoning) ───

export class VerboseReporter implements Reporter {
  onRunStart(totalTests: number, totalRunners: number): void {
    console.log(chalk.bold(`\n🧪 AgentEval — ${totalTests} test(s) × ${totalRunners} runner(s)\n`));
  }

  onFileStart(filePath: string): void {
    console.log(chalk.bold(`\n📄 ${filePath}`));
  }

  onTestStart(event: TestEvent): void {
    console.log(chalk.blue(`\n▶ ${event.testId}`) + chalk.gray(` [${event.runner}]`));
  }

  onGitReset(): void {
    console.log(chalk.dim("  ↺ git reset --hard && git clean -fd"));
  }

  onFileWrite(_event: TestEvent, filePath: string): void {
    console.log(chalk.dim(`  📝 wrote ${filePath}`));
  }

  onTestPass(event: TestResultEvent): void {
    const score = chalk.yellow(event.entry.score.toFixed(2));
    const dur = chalk.dim(`${(event.durationMs / 1000).toFixed(1)}s`);
    console.log(`  ${chalk.green("✓")} Score: ${score} – ${chalk.green("PASS")} ${dur}`);
    if (event.entry.reason) {
      console.log(chalk.dim(`    Reason: ${truncate(event.entry.reason, 120)}`));
    }
  }

  onTestFail(event: TestResultEvent): void {
    const score = chalk.yellow(event.entry.score.toFixed(2));
    const dur = chalk.dim(`${(event.durationMs / 1000).toFixed(1)}s`);
    console.log(`  ${chalk.red("✗")} Score: ${score} – ${chalk.red("FAIL")} ${dur}`);
    if (event.entry.reason) {
      console.log(chalk.dim(`    Reason: ${truncate(event.entry.reason, 120)}`));
    }
    if (event.entry.improvement) {
      console.log(chalk.dim(`    Improve: ${truncate(event.entry.improvement, 120)}`));
    }
  }

  onTestError(event: TestEvent, error: string): void {
    console.log(`  ${chalk.red("✗")} ${chalk.red("Error:")} ${error}`);
  }

  onRunEnd(results: TestResultEvent[], durationMs: number): void {
    const passed = results.filter((r) => r.entry.pass).length;
    const failed = results.length - passed;

    console.log("");
    printSummaryTable(results);

    console.log(chalk.bold("\n─── Summary ───"));
    console.log(chalk.green(`  ✓ ${passed} passed`));
    if (failed > 0) {
      console.log(chalk.red(`  ✗ ${failed} failed`));
    }
    console.log(chalk.dim(`  ⏱ ${(durationMs / 1000).toFixed(1)}s total\n`));
  }
}

// ─── Summary Table ───

function printSummaryTable(results: TestResultEvent[]): void {
  if (results.length === 0) return;

  // Column widths
  const testCol = Math.max(6, ...results.map((r) => r.testId.length)) + 2;
  const runnerCol = Math.max(8, ...results.map((r) => r.runner.length)) + 2;

  const hdr =
    chalk.dim("  ") +
    pad("Test", testCol) +
    pad("Runner", runnerCol) +
    pad("Score", 8) +
    pad("Status", 8) +
    pad("Duration", 10);

  const sep = chalk.dim("  " + "─".repeat(testCol + runnerCol + 8 + 8 + 10));

  console.log(chalk.bold("─── Results ───\n"));
  console.log(hdr);
  console.log(sep);

  for (const r of results) {
    const status = r.entry.pass ? chalk.green("PASS") : chalk.red("FAIL");
    const score = chalk.yellow(r.entry.score.toFixed(2));
    const dur = `${(r.durationMs / 1000).toFixed(1)}s`;

    console.log(
      chalk.dim("  ") +
        pad(r.testId, testCol) +
        pad(r.runner, runnerCol) +
        pad(score, 8) +
        pad(status, 8) +
        pad(dur, 10),
    );
  }
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
