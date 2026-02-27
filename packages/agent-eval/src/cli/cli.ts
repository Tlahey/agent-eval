#!/usr/bin/env node

import { resolve } from "node:path";
import { program } from "commander";
import chalk from "chalk";
import ora from "ora";
import { glob } from "glob";
import { createJiti } from "jiti";
import { loadConfig } from "../core/config.js";
import { getRegisteredTests, clearRegisteredTests, initSession } from "../index.js";
import { runTest } from "../core/runner.js";
import {
  readLedger,
  readLedgerByTestId,
  getTestIds,
  getRunnerStats,
  getAllRunnerStats,
} from "../ledger/ledger.js";

program.name("agenteval").description("AI coding agent evaluation framework").version("0.1.0");

// ─── Shared run logic ───

interface RunOptions {
  config?: string;
  filter?: string;
  tag?: string;
  output?: string;
}

async function executeRun(opts: RunOptions): Promise<void> {
  const cwd = process.cwd();
  const spinner = ora("Loading config...").start();

  try {
    const config = await loadConfig(cwd, opts.config);
    if (opts.output) {
      config.outputDir = opts.output;
    }

    initSession(config);
    spinner.succeed("Config loaded");

    // Discover test files
    const patterns =
      typeof config.testFiles === "string"
        ? [config.testFiles]
        : (config.testFiles ?? ["**/*.eval.{ts,js,mts,mjs}"]);

    const files = await glob(patterns, {
      cwd,
      ignore: ["node_modules/**", "dist/**"],
      absolute: true,
    });

    if (files.length === 0) {
      console.log(chalk.yellow("No test files found."));
      process.exit(0);
    }

    console.log(chalk.dim(`Found ${files.length} test file(s)\n`));

    // Load test files sequentially (each file registers tests via test())
    const jiti = createJiti(cwd, { interopDefault: true });

    let totalPassed = 0;
    let totalFailed = 0;

    for (const file of files) {
      clearRegisteredTests();
      await jiti.import(file);

      let tests = getRegisteredTests();

      // Apply filters
      if (opts.filter) {
        tests = tests.filter((t) => t.title.toLowerCase().includes(opts.filter!.toLowerCase()));
      }
      if (opts.tag) {
        tests = tests.filter((t) => t.tags?.includes(opts.tag!));
      }

      if (tests.length === 0) continue;

      const relPath = file.replace(cwd + "/", "");
      console.log(chalk.bold(`📄 ${relPath}`));

      // Run each test sequentially
      for (const testDef of tests) {
        const results = await runTest(testDef, config);
        for (const r of results) {
          if (r.passed) totalPassed++;
          else totalFailed++;
        }
      }
    }

    // Summary
    console.log(chalk.bold("\n─── Summary ───"));
    console.log(chalk.green(`  ✓ ${totalPassed} passed`));
    if (totalFailed > 0) {
      console.log(chalk.red(`  ✗ ${totalFailed} failed`));
    }
    console.log();

    process.exit(totalFailed > 0 ? 1 : 0);
  } catch (err: unknown) {
    spinner.fail("Failed");
    console.error(chalk.red(err instanceof Error ? err.message : String(err)));
    process.exit(1);
  }
}

// ─── Run command ───

program
  .command("run")
  .description("Execute evaluation tests")
  .option("-c, --config <path>", "Path to config file")
  .option("-f, --filter <pattern>", "Filter tests by title (substring match)")
  .option("-t, --tag <tag>", "Filter tests by tag")
  .option("-o, --output <dir>", "Override output directory for the ledger database")
  .action(executeRun);

// ─── Ledger command ───

program
  .command("ledger")
  .description("View the evaluation ledger")
  .option("--json", "Output as JSON")
  .option("-o, --output <dir>", "Override ledger directory")
  .action(async (opts) => {
    const cwd = process.cwd();
    let outputDir: string;

    if (opts.output) {
      outputDir = resolve(cwd, opts.output);
    } else {
      const config = await loadConfig(cwd);
      outputDir = resolve(cwd, config.outputDir ?? ".agenteval");
    }

    const entries = readLedger(outputDir);

    if (entries.length === 0) {
      console.log(chalk.yellow("No ledger entries found."));
      return;
    }

    if (opts.json) {
      console.log(JSON.stringify(entries, null, 2));
      return;
    }

    const testIds = getTestIds(outputDir);
    console.log(chalk.bold(`Ledger: ${entries.length} entries, ${testIds.length} unique tests\n`));

    for (const entry of entries.slice(-20)) {
      const icon = entry.pass ? chalk.green("✓") : chalk.red("✗");
      const score = chalk.yellow(entry.score.toFixed(2));
      const date = new Date(entry.timestamp).toLocaleString();
      console.log(
        `${icon} ${score} ${chalk.bold(entry.testId)} [${entry.agentRunner}] ${chalk.dim(date)}`,
      );
    }

    if (entries.length > 20) {
      console.log(
        chalk.dim(`\n  ... and ${entries.length - 20} more. Use --json for full output.`),
      );
    }
  });

// ─── UI / View handler ───

interface UiOptions {
  port: string;
  output?: string;
}

async function launchDashboard(opts: UiOptions): Promise<void> {
  const cwd = process.cwd();
  let outputDir: string;

  if (opts.output) {
    outputDir = resolve(cwd, opts.output);
  } else {
    const config = await loadConfig(cwd);
    outputDir = resolve(cwd, config.outputDir ?? ".agenteval");
  }

  const port = parseInt(opts.port, 10);

  console.log(chalk.bold("🧪 AgentEval Dashboard\n"));
  console.log(chalk.dim(`  Ledger: ${outputDir}/ledger.sqlite`));
  console.log(chalk.dim(`  Port:   ${port}`));
  console.log();

  const { createServer } = await import("node:http");

  const server = createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/json");

    const url = new URL(req.url ?? "/", `http://localhost:${port}`);

    try {
      if (url.pathname === "/api/runs") {
        const testId = url.searchParams.get("testId");
        const entries = testId ? readLedgerByTestId(outputDir, testId) : readLedger(outputDir);
        res.end(JSON.stringify(entries));
      } else if (url.pathname === "/api/tests") {
        res.end(JSON.stringify(getTestIds(outputDir)));
      } else if (url.pathname === "/api/stats") {
        const testId = url.searchParams.get("testId");
        const stats = testId ? getRunnerStats(outputDir, testId) : getAllRunnerStats(outputDir);
        res.end(JSON.stringify(stats));
      } else {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "Not found" }));
      }
    } catch (err: unknown) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    }
  });

  server.listen(port, () => {
    console.log(chalk.green(`  ✓ API server running at http://localhost:${port}`));
    console.log(chalk.dim(`\n  Endpoints:`));
    console.log(chalk.dim(`    GET /api/runs          All runs (or ?testId=...)`));
    console.log(chalk.dim(`    GET /api/tests         List of test IDs`));
    console.log(chalk.dim(`    GET /api/stats         Aggregate stats per runner`));
    console.log(chalk.dim(`\n  Press Ctrl+C to stop.\n`));
  });
}

program
  .command("ui")
  .description("Launch the evaluation dashboard")
  .option("-p, --port <port>", "Port to serve on", "4747")
  .option("-o, --output <dir>", "Override ledger directory")
  .action(launchDashboard);

// `view` is an alias for `ui`
program
  .command("view")
  .description("Launch the evaluation dashboard (alias for ui)")
  .option("-p, --port <port>", "Port to serve on", "4747")
  .option("-o, --output <dir>", "Override ledger directory")
  .action(launchDashboard);

// ─── Default command: treat unknown args as `run` ───

const KNOWN_COMMANDS = ["run", "ledger", "ui", "view", "help", "--help", "-h", "--version", "-V"];

// If no command is given (e.g., `agenteval` or `agenteval .`), default to `run`
if (process.argv.length <= 2 || (process.argv.length === 3 && !process.argv[2].startsWith("-"))) {
  const arg = process.argv[2];
  if (arg && !KNOWN_COMMANDS.includes(arg)) {
    // Treat as `agenteval run` (user typed `agenteval .` or similar)
    process.argv.splice(2, 0, "run");
  }
}

program.parse();
