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
import { readLedger, getTestIds } from "../ledger/ledger.js";

program.name("agenteval").description("AI coding agent evaluation framework").version("0.1.0");

// ─── Run command ───

program
  .command("run")
  .description("Execute evaluation tests")
  .option("-c, --config <path>", "Path to config file")
  .option("-f, --filter <pattern>", "Filter tests by title (substring match)")
  .option("-t, --tag <tag>", "Filter tests by tag")
  .action(async (opts) => {
    const cwd = process.cwd();
    const spinner = ora("Loading config...").start();

    try {
      const config = await loadConfig(cwd);
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
          tests = tests.filter((t) => t.title.toLowerCase().includes(opts.filter.toLowerCase()));
        }
        if (opts.tag) {
          tests = tests.filter((t) => t.tags?.includes(opts.tag));
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
  });

// ─── Ledger command ───

program
  .command("ledger")
  .description("View the evaluation ledger")
  .option("--json", "Output as JSON")
  .action(async (opts) => {
    const cwd = process.cwd();
    const config = await loadConfig(cwd);
    const outputDir = resolve(cwd, config.outputDir ?? ".agenteval");
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

// ─── UI command (placeholder for Phase 2) ───

program
  .command("ui")
  .description("Launch the evaluation dashboard (Phase 2)")
  .action(() => {
    console.log(
      chalk.yellow(
        "The visual dashboard is planned for Phase 2. Use `agenteval ledger` to view results.",
      ),
    );
  });

program.parse();
